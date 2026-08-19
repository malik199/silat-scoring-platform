import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function DELETE(req: NextRequest) {
  try {
    // Verify the caller is authenticated
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth().verifyIdToken(token);
    const callerUid = decoded.uid;

    // Verify the caller is a super admin
    const callerDoc = await adminDb().collection("users").doc(callerUid).get();
    if (!callerDoc.exists || !callerDoc.data()?.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { targetUid } = await req.json();
    if (!targetUid) return NextResponse.json({ error: "targetUid required" }, { status: 400 });

    // Prevent self-deletion
    if (targetUid === callerUid) {
      return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
    }

    const db = adminDb();

    // Delete competitors
    const competitors = await db.collection("competitors").where("organiserId", "==", targetUid).get();
    const batch1 = db.batch();
    competitors.docs.forEach((d) => batch1.delete(d.ref));
    if (competitors.size > 0) await batch1.commit();

    // Delete tournaments
    const tournaments = await db.collection("tournaments").where("organiserId", "==", targetUid).get();
    const batch2 = db.batch();
    tournaments.docs.forEach((d) => batch2.delete(d.ref));
    if (tournaments.size > 0) await batch2.commit();

    // Delete user profile
    await db.collection("users").doc(targetUid).delete();

    // Delete Firebase Auth account
    await adminAuth().deleteUser(targetUid);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
