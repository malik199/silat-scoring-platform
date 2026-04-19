import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import 'pin_entry_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool   _loading = false;
  String? _error;

  Future<void> _signInWithGoogle() async {
    setState(() { _loading = true; _error = null; });
    try {
      final googleUser = await GoogleSignIn().signIn();
      if (googleUser == null) {
        // User cancelled
        setState(() => _loading = false);
        return;
      }
      final googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken:     googleAuth.idToken,
      );
      await FirebaseAuth.instance.signInWithCredential(credential);
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const PinEntryScreen()),
        );
      }
    } catch (e) {
      setState(() { _loading = false; _error = 'Google sign-in failed. Please try again.'; });
    }
  }

  Future<void> _signInWithFacebook() async {
    setState(() { _loading = true; _error = null; });
    try {
      final result = await FacebookAuth.instance.login();
      if (result.status != LoginStatus.success) {
        setState(() => _loading = false);
        return;
      }
      final credential = FacebookAuthProvider.credential(result.accessToken!.tokenString);
      await FirebaseAuth.instance.signInWithCredential(credential);
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const PinEntryScreen()),
        );
      }
    } catch (e) {
      setState(() { _loading = false; _error = 'Facebook sign-in failed. Please try again.'; });
    }
  }

  Future<void> _signInWithApple() async {
    setState(() { _loading = true; _error = null; });
    try {
      final appleCredential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );
      final oauthCredential = OAuthProvider('apple.com').credential(
        idToken:     appleCredential.identityToken,
        accessToken: appleCredential.authorizationCode,
      );
      await FirebaseAuth.instance.signInWithCredential(oauthCredential);
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const PinEntryScreen()),
        );
      }
    } catch (e) {
      setState(() { _loading = false; _error = 'Apple sign-in failed. Please try again.'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final showApple = !kIsWeb && Platform.isIOS;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      body: Stack(
        children: [
          Row(
            children: [
              // ── Left panel: branding ─────────────────────────────────────
              Expanded(
                child: Container(
                  color: const Color(0xFF111111),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Image.asset('assets/score_silat.png', width: 120),
                        const SizedBox(height: 20),
                        const Text(
                          'Silat Judge',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 1,
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Tournament Mode',
                          style: TextStyle(fontSize: 13, color: Colors.white38),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // ── Right panel: sign-in ─────────────────────────────────────
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 340),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Sign in to continue',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Your identity is recorded with each score event.',
                          style: TextStyle(color: Colors.white38, fontSize: 12, height: 1.4),
                        ),
                        const SizedBox(height: 28),

                        // Google button
                        _SignInButton(
                          onTap: _loading ? null : _signInWithGoogle,
                          icon: _GoogleIcon(),
                          label: 'Continue with Google',
                          foreground: Colors.white,
                          background: const Color(0xFF222222),
                          border: const Color(0xFF444444),
                        ),

                        const SizedBox(height: 12),
                        _SignInButton(
                          onTap: _loading ? null : _signInWithFacebook,
                          icon: const _FacebookIcon(),
                          label: 'Continue with Facebook',
                          foreground: Colors.white,
                          background: const Color(0xFF1877F2),
                          border: const Color(0xFF1877F2),
                        ),

                        if (showApple) ...[
                          const SizedBox(height: 12),
                          _SignInButton(
                            onTap: _loading ? null : _signInWithApple,
                            icon: const Icon(Icons.apple, color: Colors.white, size: 20),
                            label: 'Continue with Apple',
                            foreground: Colors.black,
                            background: Colors.white,
                            border: Colors.white,
                          ),
                        ],

                        if (_error != null) ...[
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: Colors.red.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                            ),
                            child: Text(
                              _error!,
                              style: const TextStyle(color: Colors.red, fontSize: 12),
                            ),
                          ),
                        ],

                        const SizedBox(height: 24),
                        TextButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text(
                            '← Back',
                            style: TextStyle(color: Colors.white30, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),

          // Loading overlay
          if (_loading)
            Container(
              color: Colors.black.withValues(alpha: 0.5),
              child: const Center(
                child: CircularProgressIndicator(color: Colors.white54),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Sign-in button ────────────────────────────────────────────────────────────

class _SignInButton extends StatefulWidget {
  final VoidCallback? onTap;
  final Widget icon;
  final String label;
  final Color foreground;
  final Color background;
  final Color border;

  const _SignInButton({
    required this.onTap,
    required this.icon,
    required this.label,
    required this.foreground,
    required this.background,
    required this.border,
  });

  @override
  State<_SignInButton> createState() => _SignInButtonState();
}

class _SignInButtonState extends State<_SignInButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp:   (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedOpacity(
        opacity: widget.onTap == null ? 0.4 : (_pressed ? 0.7 : 1.0),
        duration: const Duration(milliseconds: 80),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          decoration: BoxDecoration(
            color: widget.background,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: widget.border),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              widget.icon,
              const SizedBox(width: 12),
              Text(
                widget.label,
                style: TextStyle(
                  color: widget.foreground,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Google coloured G icon ────────────────────────────────────────────────────

class _GoogleIcon extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 20,
      height: 20,
      child: CustomPaint(painter: _GooglePainter()),
    );
  }
}

class _GooglePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r  = size.width / 2;

    // Simplified coloured G — four quadrant arcs
    const colors = [
      Color(0xFF4285F4), // blue  (top-right)
      Color(0xFF34A853), // green (bottom-right)
      Color(0xFFFBBC05), // yellow (bottom-left)
      Color(0xFFEA4335), // red   (top-left)
    ];
    const startAngles = [-1.5708, 0.0, 1.5708, 3.1416]; // -90°, 0°, 90°, 180°

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.2;

    for (int i = 0; i < 4; i++) {
      paint.color = colors[i];
      canvas.drawArc(
        Rect.fromCircle(center: Offset(cx, cy), radius: r * 0.75),
        startAngles[i],
        1.5708,
        false,
        paint,
      );
    }

    // White bar for the right arm of the G
    final barPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = size.width * 0.2
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(
      Offset(cx + r * 0.3, cy),
      Offset(cx + r * 0.75, cy),
      barPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ── Facebook f icon ───────────────────────────────────────────────────────────

class _FacebookIcon extends StatelessWidget {
  const _FacebookIcon();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 20,
      height: 20,
      child: Center(
        child: Text(
          'f',
          style: TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.bold,
            fontFamily: 'serif',
          ),
        ),
      ),
    );
  }
}
