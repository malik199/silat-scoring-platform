import Link from "next/link";

export default function TutorialPage() {
  return (
    <div className="min-h-screen bg-base flex flex-col">
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-base/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-primary text-lg tracking-tight">
            Silat Score
          </Link>
          <Link href="/" className="text-sm text-secondary hover:text-primary transition-colors">
            ← Back to Home
          </Link>
        </div>
      </nav>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-primary mb-2">Video Tutorial</h1>
        <p className="text-secondary mb-8">
          Watch this walkthrough to see how the Silat Score system works from start to finish.
        </p>

        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            className="absolute inset-0 w-full h-full rounded-xl border border-border"
            src="https://www.youtube.com/embed/hEEpHORzJR8"
            title="Silat Score Tutorial"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </main>
    </div>
  );
}
