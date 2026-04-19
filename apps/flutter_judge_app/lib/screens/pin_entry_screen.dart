import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../firestore_rest.dart';
import 'role_selection_screen.dart';

class PinEntryScreen extends StatefulWidget {
  const PinEntryScreen({super.key});

  @override
  State<PinEntryScreen> createState() => _PinEntryScreenState();
}

class _PinEntryScreenState extends State<PinEntryScreen> {
  String _pin    = '';
  bool   _loading = false;
  String? _error;

  void _onKey(String digit) {
    if (_pin.length >= 4 || _loading) return;
    setState(() { _pin += digit; _error = null; });
    if (_pin.length == 4) _validatePin();
  }

  void _onDelete() {
    if (_pin.isEmpty || _loading) return;
    setState(() { _pin = _pin.substring(0, _pin.length - 1); _error = null; });
  }

  void _onClear() {
    if (_loading) return;
    setState(() { _pin = ''; _error = null; });
  }

  Future<void> _validatePin() async {
    setState(() { _loading = true; _error = null; });
    try {
      final match = await findArenaByPin(_pin);
      if (!mounted) return;
      if (match == null) {
        setState(() { _loading = false; _error = 'Incorrect PIN. Try again.'; _pin = ''; });
        return;
      }
      setState(() => _loading = false);
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => RoleSelectionScreen(
            arenaNumber:    match.arenaNumber,
            tournamentId:   match.tournamentId,
            tournamentName: match.tournamentName,
          ),
        ),
      );
    } catch (e) {
      setState(() { _loading = false; _error = 'Connection error. Try again.'; _pin = ''; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      body: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Left panel: branding ──────────────────────────────────────────
          // ── Left panel: branding + PIN display ───────────────────────────
          Expanded(
            child: Container(
              color: const Color(0xFF111111),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [

                                    // Back + Sign out row
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        GestureDetector(
                          onTap: () => Navigator.of(context).pop(),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.arrow_back_ios, color: Colors.white54, size: 16),
                              SizedBox(width: 4),
                              Text('Back', style: TextStyle(color: Colors.white54, fontSize: 13)),
                            ],
                          ),
                        ),
                        const SizedBox(width: 24),
                        GestureDetector(
                          onTap: () async {
                            await FirebaseAuth.instance.signOut();
                            if (context.mounted) Navigator.of(context).pop();
                          },
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.logout, color: Colors.white24, size: 16),
                              SizedBox(width: 4),
                              Text('Sign out', style: TextStyle(color: Colors.white24, fontSize: 13)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // PIN title
                    const Text(
                      'Enter Arena PIN',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Ask your admin for the 4-digit PIN',
                      style: TextStyle(fontSize: 11, color: Colors.white38),
                    ),
                    const SizedBox(height: 20),

                    // PIN dots
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(4, (i) {
                        final filled = i < _pin.length;
                        return Container(
                          margin: const EdgeInsets.symmetric(horizontal: 6),
                          width: 48,
                          height: 56,
                          decoration: BoxDecoration(
                            color: filled
                                ? Colors.white.withValues(alpha: 0.12)
                                : Colors.white.withValues(alpha: 0.04),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: filled
                                  ? Colors.white.withValues(alpha: 0.5)
                                  : Colors.white.withValues(alpha: 0.1),
                              width: 1.5,
                            ),
                          ),
                          child: Center(
                            child: filled
                                ? Text(
                                    _pin[i],
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 22,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  )
                                : null,
                          ),
                        );
                      }),
                    ),

                    // Error
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 200),
                      child: _error != null
                          ? Padding(
                              key: ValueKey(_error),
                              padding: const EdgeInsets.only(top: 12),
                              child: Text(
                                _error!,
                                style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                                textAlign: TextAlign.center,
                              ),
                            )
                          : const SizedBox(height: 12),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Right panel: number pad ───────────────────────────────────────
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _loading
                    ? const CircularProgressIndicator(color: Colors.white54)
                    : _NumberPad(onKey: _onKey, onDelete: _onDelete, onClear: _onClear),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Number pad ───────────────────────────────────────────────────────────────

class _NumberPad extends StatelessWidget {
  final void Function(String) onKey;
  final VoidCallback onDelete;
  final VoidCallback onClear;

  const _NumberPad({required this.onKey, required this.onDelete, required this.onClear});

  @override
  Widget build(BuildContext context) {
    const rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
    ];

    return Column(
      children: [
        for (final row in rows) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: row.map((d) => _PadKey(label: d, onTap: () => onKey(d))).toList(),
          ),
          const SizedBox(height: 8),
        ],
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _PadKey(label: 'C', onTap: onClear, subtle: true),
            _PadKey(label: '0', onTap: () => onKey('0')),
            _PadKey(label: '⌫', onTap: onDelete, subtle: true),
          ],
        ),
      ],
    );
  }
}

class _PadKey extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final bool subtle;

  const _PadKey({required this.label, required this.onTap, this.subtle = false});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 6),
        width: 62,
        height: 52,
        decoration: BoxDecoration(
          color: subtle
              ? Colors.white.withValues(alpha: 0.04)
              : Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.08),
          ),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: label.length == 1 && label.codeUnitAt(0) >= 48 && label.codeUnitAt(0) <= 57
                  ? 22
                  : 18,
              fontWeight: FontWeight.w600,
              color: subtle ? Colors.white38 : Colors.white,
            ),
          ),
        ),
      ),
    );
  }
}
