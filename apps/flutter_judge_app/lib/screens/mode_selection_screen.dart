import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import 'login_screen.dart';
import 'pin_entry_screen.dart';
import 'scoring_landscape.dart';

class ModeSelectionScreen extends StatelessWidget {
  const ModeSelectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      body: Row(
        children: [
          // ── Left panel: branding ─────────────────────────────────────────
          Expanded(
            child: Container(
              color: const Color(0xFF111111),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Image.asset('assets/score_silat.png', width: 140),
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
                      'Scoring App',
                      style: TextStyle(fontSize: 13, color: Colors.white38),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Right panel: mode selection ──────────────────────────────────
          Expanded(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 360),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 8),

                    _ModeCard(
                      icon: Icons.school_outlined,
                      title: 'School / Perguruan',
                      description: 'Quick scoring for practice sessions or school events. No tournament setup needed.',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const ScoringLandscape(
                            arenaNumber:    1,
                            tournamentId:   '',
                            tournamentName: '',
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 12),

                    _ModeCard(
                      icon: Icons.emoji_events_outlined,
                      title: 'Tournament',
                      description: 'Select your tournament and enter your arena PIN. For official competitions.',
                      onTap: () {
                        final user = FirebaseAuth.instance.currentUser;
                        final isSignedIn = user != null && !user.isAnonymous;
                        Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => isSignedIn
                              ? const PinEntryScreen()
                              : const LoginScreen(),
                        ));
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ModeCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final VoidCallback onTap;

  const _ModeCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: Colors.white70, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: const TextStyle(
                      color: Colors.white38,
                      fontSize: 11,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right, color: Colors.white24, size: 20),
          ],
        ),
      ),
    );
  }
}
