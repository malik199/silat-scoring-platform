import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../config.dart';
import '../firestore_rest.dart';
import 'pin_entry_screen.dart';

class TournamentListScreen extends StatelessWidget {
  const TournamentListScreen({super.key});

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

          // ── Right panel: tournament list ─────────────────────────────────
          Expanded(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 360),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      child: const Row(
                        children: [
                          Icon(Icons.arrow_back_ios, color: Colors.white54, size: 16),
                          SizedBox(width: 4),
                          Text('Back', style: TextStyle(color: Colors.white54, fontSize: 13)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Select Tournament',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Tap your tournament to enter your arena PIN',
                      style: TextStyle(fontSize: 12, color: Colors.white38),
                    ),
                    const SizedBox(height: 24),
                    _TournamentList(),
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

class _TournamentList extends StatefulWidget {
  @override
  State<_TournamentList> createState() => _TournamentListState();
}

class _TournamentListState extends State<_TournamentList> {
  List<TournamentDoc>? _tournaments;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final List<TournamentDoc> tournaments;
      if (useEmulator) {
        // iOS simulator can't reach the Firestore emulator via gRPC,
        // so we use the REST API directly.
        tournaments = await fetchTournaments();
      } else {
        // Production — real Firebase SDK works fine over the internet.
        final snap = await FirebaseFirestore.instance.collection('tournaments').get();
        tournaments = snap.docs.map((d) {
          final data = d.data();
          final pins = Map<String, dynamic>.from(data['arenaPins'] as Map? ?? {});
          return TournamentDoc(
            id:        d.id,
            name:      data['name'] as String? ?? '',
            status:    data['status'] as String? ?? '',
            arenaPins: pins.map((k, v) => MapEntry(k, v.toString())),
          );
        }).toList();
      }
      debugPrint('=== Tournaments fetched: ${tournaments.length}');
      setState(() => _tournaments = tournaments);
    } catch (e) {
      debugPrint('=== Fetch error: $e');
      setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 13));
    }

    if (_tournaments == null) {
      return const Center(child: CircularProgressIndicator(color: Colors.white54));
    }

    if (_tournaments!.isEmpty) {
      return const Text(
        'No tournaments found.',
        style: TextStyle(color: Colors.white38, fontSize: 14),
      );
    }

    return Column(
      children: _tournaments!.map((t) {
        return GestureDetector(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => const PinEntryScreen(),
            ),
          ),
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t.name,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _statusLabel(t.status),
                        style: TextStyle(
                          color: _statusColor(t.status),
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: Colors.white24, size: 20),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  String _statusLabel(String s) => switch (s) {
    'draft'             => 'Draft',
    'registration_open' => 'Registration Open',
    'in_progress'       => 'In Progress',
    'completed'         => 'Completed',
    'cancelled'         => 'Cancelled',
    _                   => s,
  };

  Color _statusColor(String s) => switch (s) {
    'in_progress' => Colors.orangeAccent,
    'completed'   => Colors.greenAccent,
    'cancelled'   => Colors.redAccent,
    _             => Colors.white38,
  };
}
