import 'dart:async';
import 'package:flutter/material.dart';

import '../firestore_rest.dart';

const int _totalRounds       = 3;
const int _restDurationSecs  = 60;

class TimekeeperScreen extends StatefulWidget {
  final int    arenaNumber;
  final String tournamentId;
  final String tournamentName;

  const TimekeeperScreen({
    super.key,
    required this.arenaNumber,
    required this.tournamentId,
    required this.tournamentName,
  });

  @override
  State<TimekeeperScreen> createState() => _TimekeeperScreenState();
}

class _TimekeeperScreenState extends State<TimekeeperScreen> {
  // ── Match state ──────────────────────────────────────────────────────────────
  MatchDoc? _match;
  bool      _loadingMatch = true;
  Timer?    _pollTimer;
  Timer?    _tickTimer;

  // ── Displayed remaining seconds ──────────────────────────────────────────────
  double _remaining = 120;

  // ── Button debounce ──────────────────────────────────────────────────────────
  bool _busy = false;

  // ── Confirm next-round dialog ────────────────────────────────────────────────
  bool _confirmNext = false;

  // ── Local rest period ────────────────────────────────────────────────────────
  bool   _inRest       = false;
  int    _restRemaining = _restDurationSecs;
  Timer? _restTimer;

  // ────────────────────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _fetchMatch();
    // Poll Firestore every 2 s so timer state stays in sync with web admin
    _pollTimer = Timer.periodic(const Duration(seconds: 2), (_) => _fetchMatch());
    // Tick display 10× per second for smooth countdown
    _tickTimer = Timer.periodic(const Duration(milliseconds: 100), (_) => _tick());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    _restTimer?.cancel();
    super.dispose();
  }

  // ── Data fetching ────────────────────────────────────────────────────────────

  Future<void> _fetchMatch() async {
    try {
      final match = await fetchActiveMatch(widget.tournamentId, widget.arenaNumber);
      if (!mounted) return;
      setState(() { _match = match; _loadingMatch = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingMatch = false);
    }
  }

  void _tick() {
    if (!mounted || _match == null) return;
    setState(() => _remaining = _computeRemaining(_match!));
  }

  double _computeRemaining(MatchDoc m) {
    final duration = m.roundDurationSeconds.toDouble();
    double extra = 0;
    if (m.timerRunning && m.timerStartedAt != null) {
      extra = DateTime.now().toUtc().difference(m.timerStartedAt!).inMilliseconds / 1000.0;
    }
    return (duration - (m.timerElapsedSeconds + extra)).clamp(0.0, duration);
  }

  // ── Timer controls ───────────────────────────────────────────────────────────

  Future<void> _handleStart() async {
    if (_match == null || _match!.timerRunning || _busy) return;
    setState(() => _busy = true);
    await timerStart(_match!.id);
    await _fetchMatch();
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _handleStop() async {
    if (_match == null || !_match!.timerRunning || _busy) return;
    setState(() => _busy = true);
    final elapsed = (_match!.roundDurationSeconds.toDouble() - _remaining)
        .clamp(0.0, _match!.roundDurationSeconds.toDouble());
    await timerStop(_match!.id, elapsed);
    await _fetchMatch();
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _handleReset() async {
    if (_match == null || _match!.timerRunning || _busy) return;
    setState(() => _busy = true);
    await timerReset(_match!.id);
    await _fetchMatch();
    if (mounted) setState(() { _busy = false; _confirmNext = false; });
  }

  Future<void> _handleNextRound() async {
    if (_match == null || _match!.timerRunning || _busy) return;
    final next = _match!.currentRound + 1;
    if (next > _totalRounds) return;
    setState(() => _busy = true);
    await advanceRound(_match!.id, next);
    await _fetchMatch();
    if (mounted) {
      setState(() { _busy = false; _confirmNext = false; });
      _startRest();
    }
  }

  // ── Rest period ──────────────────────────────────────────────────────────────

  void _startRest() {
    _restTimer?.cancel();
    setState(() { _inRest = true; _restRemaining = _restDurationSecs; });
    _restTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      setState(() {
        _restRemaining--;
        if (_restRemaining <= 0) { _inRest = false; t.cancel(); }
      });
    });
  }

  void _skipRest() {
    _restTimer?.cancel();
    if (mounted) setState(() => _inRest = false);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  String _fmt(double secs) {
    final s = secs.floor();
    return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
  }

  // ── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final isRunning    = _match?.timerRunning ?? false;
    final currentRound = _match?.currentRound ?? 1;
    final isLastRound  = currentRound >= _totalRounds;
    final isExpired    = _remaining <= 0 && _match != null;
    final urgent       = isRunning && _remaining <= 10;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 500),
      color: urgent ? const Color(0xFF3B0000) : const Color(0xFF0A0A0A),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: const Color(0xFF111111),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios, color: Colors.white54, size: 18),
            onPressed: () => Navigator.of(context).pop(),
          ),
          title: Text(
            '${widget.tournamentName}  •  Arena ${widget.arenaNumber}',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4CAF50).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF4CAF50).withValues(alpha: 0.4)),
                  ),
                  child: const Text(
                    'TIMEKEEPER',
                    style: TextStyle(
                      color: Color(0xFF4CAF50),
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        body: _loadingMatch
            ? const Center(child: CircularProgressIndicator(color: Colors.white54))
            : _inRest
                ? _buildRest()
                : _match == null
                    ? _buildWaiting()
                    : _buildControls(isRunning, currentRound, isLastRound, isExpired),
      ),
    );
  }

  // ── Waiting ──────────────────────────────────────────────────────────────────

  Widget _buildWaiting() {
    return const Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.hourglass_empty, color: Colors.white24, size: 48),
        SizedBox(height: 16),
        Text('Waiting for match to start…',
            style: TextStyle(color: Colors.white54, fontSize: 16)),
        SizedBox(height: 8),
        Text('Admin will start the match from the web app.',
            style: TextStyle(color: Colors.white24, fontSize: 12)),
      ]),
    );
  }

  // ── Rest period ──────────────────────────────────────────────────────────────

  Widget _buildRest() {
    final restUrgent = _restRemaining <= 10;
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text(
          'REST PERIOD',
          style: TextStyle(
            color: Colors.white38,
            fontSize: 13,
            fontWeight: FontWeight.bold,
            letterSpacing: 2,
          ),
        ),
        const SizedBox(height: 20),
        Text(
          _fmt(_restRemaining.toDouble()),
          style: TextStyle(
            color: restUrgent ? Colors.orangeAccent : Colors.white70,
            fontSize: 100,
            fontWeight: FontWeight.w900,
            height: 1,
          ),
        ),
        const SizedBox(height: 36),
        GestureDetector(
          onTap: _skipRest,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 14),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
            ),
            child: const Text(
              'Skip Rest',
              style: TextStyle(color: Colors.white54, fontSize: 15, fontWeight: FontWeight.bold),
            ),
          ),
        ),
      ]),
    );
  }

  // ── Main controls ────────────────────────────────────────────────────────────

  Widget _buildControls(
      bool isRunning, int currentRound, bool isLastRound, bool isExpired) {
    final timerColor = isRunning && _remaining <= 10
        ? const Color(0xFFFF5050)
        : isRunning && _remaining <= 30
            ? const Color(0xFFFFB43C)
            : Colors.white.withValues(alpha: 0.9);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 32),
      child: Column(
        children: [
          // ── Round pips ────────────────────────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(_totalRounds, (i) {
              final r         = i + 1;
              final isCurrent = r == currentRound;
              final isDone    = r < currentRound;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Column(children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    width: 52, height: 52,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isCurrent
                          ? Colors.white.withValues(alpha: 0.12)
                          : Colors.transparent,
                      border: Border.all(
                        color: isCurrent
                            ? Colors.white.withValues(alpha: 0.7)
                            : isDone
                                ? Colors.white.withValues(alpha: 0.15)
                                : Colors.white.withValues(alpha: 0.1),
                        width: 2,
                      ),
                    ),
                    child: Center(
                      child: Text(
                        isDone ? '✓' : '$r',
                        style: TextStyle(
                          color: isCurrent
                              ? Colors.white.withValues(alpha: 0.9)
                              : isDone
                                  ? Colors.white.withValues(alpha: 0.25)
                                  : Colors.white.withValues(alpha: 0.15),
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    isCurrent ? 'Current' : isDone ? 'Done' : '',
                    style: TextStyle(
                      color: isCurrent
                          ? Colors.white.withValues(alpha: 0.4)
                          : Colors.white.withValues(alpha: 0.1),
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.5,
                    ),
                  ),
                ]),
              );
            }),
          ),

          const SizedBox(height: 28),

          // ── Timer display ─────────────────────────────────────────────────
          Text(
            _fmt(_remaining),
            style: TextStyle(
              color: timerColor,
              fontSize: 110,
              fontWeight: FontWeight.w900,
              height: 1,
            ),
          ),
          if (isExpired)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                "TIME'S UP",
                style: TextStyle(
                    color: Colors.redAccent,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 2),
              ),
            ),

          const SizedBox(height: 32),

          // ── Start / Stop / Reset ──────────────────────────────────────────
          Row(children: [
            Expanded(child: _CtrlButton(
              label: 'Start', icon: '▶',
              color: const Color(0xFF00C850),
              enabled: !isRunning && !isExpired && !_busy,
              onTap: _handleStart,
            )),
            const SizedBox(width: 10),
            Expanded(child: _CtrlButton(
              label: 'Stop', icon: '■',
              color: const Color(0xFFDC3232),
              enabled: isRunning && !_busy,
              onTap: _handleStop,
            )),
            const SizedBox(width: 10),
            Expanded(child: _CtrlButton(
              label: 'Reset', icon: '↺',
              color: Colors.white54,
              enabled: !isRunning && !_busy,
              onTap: _handleReset,
            )),
          ]),

          const SizedBox(height: 20),

          // ── Next round / Final round ───────────────────────────────────────
          if (!isLastRound && !_confirmNext)
            _NextRoundButton(
              label: 'Next Round → Round ${currentRound + 1}',
              enabled: !isRunning && !_busy,
              onTap: () => setState(() => _confirmNext = true),
            ),

          if (!isLastRound && _confirmNext)
            _ConfirmRow(
              nextRound: currentRound + 1,
              onCancel:  () => setState(() => _confirmNext = false),
              onConfirm: _handleNextRound,
            ),

          if (isLastRound)
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text(
                'FINAL ROUND',
                style: TextStyle(
                    color: Colors.white24,
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Reusable widgets ─────────────────────────────────────────────────────────

class _CtrlButton extends StatefulWidget {
  final String       label;
  final String       icon;
  final Color        color;
  final bool         enabled;
  final VoidCallback onTap;

  const _CtrlButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.enabled,
    required this.onTap,
  });

  @override
  State<_CtrlButton> createState() => _CtrlButtonState();
}

class _CtrlButtonState extends State<_CtrlButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap:       widget.enabled ? widget.onTap : null,
      onTapDown:   widget.enabled ? (_) => setState(() => _pressed = true) : null,
      onTapUp:     (_) => setState(() => _pressed = false),
      onTapCancel: ()  => setState(() => _pressed = false),
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 100),
        opacity: widget.enabled ? 1.0 : 0.3,
        child: AnimatedScale(
          scale: _pressed ? 0.93 : 1.0,
          duration: const Duration(milliseconds: 80),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 22),
            decoration: BoxDecoration(
              color:         widget.color.withValues(alpha: _pressed ? 0.18 : 0.10),
              borderRadius:  BorderRadius.circular(18),
              border: Border.all(
                color: widget.color.withValues(alpha: _pressed ? 0.8 : 0.45),
                width: 2,
              ),
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(widget.icon,
                  style: TextStyle(color: widget.color, fontSize: 26)),
              const SizedBox(height: 6),
              Text(widget.label,
                  style: TextStyle(
                      color: widget.color,
                      fontSize: 13,
                      fontWeight: FontWeight.bold)),
            ]),
          ),
        ),
      ),
    );
  }
}

class _NextRoundButton extends StatelessWidget {
  final String       label;
  final bool         enabled;
  final VoidCallback onTap;

  const _NextRoundButton(
      {required this.label, required this.enabled, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 100),
        opacity: enabled ? 1.0 : 0.2,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
                color: Colors.white60, fontSize: 15, fontWeight: FontWeight.bold),
          ),
        ),
      ),
    );
  }
}

class _ConfirmRow extends StatelessWidget {
  final int          nextRound;
  final VoidCallback onCancel;
  final VoidCallback onConfirm;

  const _ConfirmRow(
      {required this.nextRound, required this.onCancel, required this.onConfirm});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.amber.withValues(alpha: 0.4)),
      ),
      child: Column(children: [
        Text(
          'Move to Round $nextRound? You cannot go back.',
          style: const TextStyle(color: Colors.white70, fontSize: 14),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: GestureDetector(
            onTap: onCancel,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 13),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
              ),
              child: const Text('Cancel',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      color: Colors.white38,
                      fontSize: 14,
                      fontWeight: FontWeight.bold)),
            ),
          )),
          const SizedBox(width: 12),
          Expanded(child: GestureDetector(
            onTap: onConfirm,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 13),
              decoration: BoxDecoration(
                color: Colors.amber.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.amber.withValues(alpha: 0.5)),
              ),
              child: Text('Round $nextRound',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: Colors.amber,
                      fontSize: 14,
                      fontWeight: FontWeight.bold)),
            ),
          )),
        ]),
      ]),
    );
  }
}
