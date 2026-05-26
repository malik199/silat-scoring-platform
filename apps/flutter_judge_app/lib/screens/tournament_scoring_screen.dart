import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../firestore_rest.dart';

class TournamentScoringScreen extends StatefulWidget {
  final int    arenaNumber;
  final String tournamentId;
  final String tournamentName;

  const TournamentScoringScreen({
    super.key,
    required this.arenaNumber,
    required this.tournamentId,
    required this.tournamentName,
  });

  @override
  State<TournamentScoringScreen> createState() => _TournamentScoringScreenState();
}

class _TournamentScoringScreenState extends State<TournamentScoringScreen> {
  // ── Match state ─────────────────────────────────────────────────────────────
  MatchDoc?       _match;
  CompetitorDoc?  _red;
  CompetitorDoc?  _blue;
  bool            _loadingMatch = true;
  Timer?          _pollTimer;

  // ── Verification state ───────────────────────────────────────────────────────
  String? _handledVerificationId;
  bool    _verificationDialogShowing = false;

  // ── Event logs ──────────────────────────────────────────────────────────────
  List<int> _redEvents  = [];
  List<int> _blueEvents = [];

  @override
  void initState() {
    super.initState();
    _fetchMatch();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _fetchMatch());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchMatch() async {
    try {
      final match = await fetchActiveMatch(widget.tournamentId, widget.arenaNumber);
      if (!mounted) return;

      if (match == null) {
        setState(() { _match = null; _red = null; _blue = null; _loadingMatch = false; });
        return;
      }

      if (match.id != _match?.id) {
        final red  = await fetchCompetitor(match.redCompetitorId);
        final blue = await fetchCompetitor(match.blueCompetitorId);
        if (!mounted) return;
        setState(() {
          _match                 = match;
          _red                   = red;
          _blue                  = blue;
          _redEvents             = [];
          _blueEvents            = [];
          _handledVerificationId = null;
          _loadingMatch          = false;
        });
      } else {
        setState(() { _match = match; _loadingMatch = false; });
      }

      _checkVerification(match);
    } catch (_) {
      if (mounted) setState(() => _loadingMatch = false);
    }
  }

  void _checkVerification(MatchDoc match) {
    final av = match.activeVerification;
    if (av == null) return;
    if (av.id == _handledVerificationId) return;
    if (_verificationDialogShowing) return;

    _handledVerificationId     = av.id;
    _verificationDialogShowing = true;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _showVerificationDialog(match.id, av.id, av.type);
    });
  }

  void _showVerificationDialog(String matchId, String verificationId, String type) {
    final isDropTakedown = type == 'drop_takedown';
    final title   = isDropTakedown ? 'Drop / Takedown Verification' : 'Protest Verification';
    final icon    = isDropTakedown ? '👇' : '✋';

    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _VerificationDialog(
        title: title,
        icon:  icon,
        onVote: (verdict) {
          postVerificationResponse(
            matchId:        matchId,
            verificationId: verificationId,
            verdict:        verdict,
          );
          _verificationDialogShowing = false;
          Navigator.of(ctx).pop();
        },
      ),
    ).then((_) {
      _verificationDialogShowing = false;
    });
  }

  void _addRed(int pts) {
    setState(() => _redEvents.add(pts));
    if (_match != null) {
      postScoreEvent(matchId: _match!.id, side: 'red', points: pts);
    }
  }

  void _addBlue(int pts) {
    setState(() => _blueEvents.add(pts));
    if (_match != null) {
      postScoreEvent(matchId: _match!.id, side: 'blue', points: pts);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: const Color(0xFF111111),
        toolbarHeight: 60,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${widget.tournamentName}  •  Arena ${widget.arenaNumber}',
              style: const TextStyle(fontSize: 11, color: Colors.white38),
            ),
            const SizedBox(height: 2),
            Text(
              FirebaseAuth.instance.currentUser?.displayName
                  ?? FirebaseAuth.instance.currentUser?.email
                  ?? 'Judge',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white),
            ),
          ],
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white54, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: _loadingMatch
          ? const Center(child: CircularProgressIndicator(color: Colors.white54))
          : _match == null
              ? _buildWaiting()
              : _buildScoring(),
    );
  }

  // ── Waiting screen ───────────────────────────────────────────────────────────
  Widget _buildWaiting() {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.hourglass_empty, color: Colors.white24, size: 48),
          SizedBox(height: 16),
          Text(
            'Waiting for match to start…',
            style: TextStyle(color: Colors.white54, fontSize: 16),
          ),
          SizedBox(height: 8),
          Text(
            'The admin will start the match from the web app.',
            style: TextStyle(color: Colors.white24, fontSize: 12),
          ),
        ],
      ),
    );
  }

  // ── Scoring screen ───────────────────────────────────────────────────────────
  Widget _buildScoring() {
    final blueTotal = _blueEvents.fold(0, (s, p) => s + p);
    final redTotal  = _redEvents.fold(0, (s, p) => s + p);

    const blue  = Color(0xFF42A5F5);
    const red   = Color(0xFFEF5350);

    return Column(
      children: [

        // ── Score headers ────────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
          child: Row(
            children: [
              Expanded(child: _buildScoreHeader(
                competitor: _blue,
                total:      blueTotal,
                color:      blue,
                isLeft:     true,
              )),
              const SizedBox(width: 10),
              Expanded(child: _buildScoreHeader(
                competitor: _red,
                total:      redTotal,
                color:      red,
                isLeft:     false,
              )),
            ],
          ),
        ),

        // ── Buttons + round badge ────────────────────────────────────────────
        Expanded(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [

                // Blue buttons — stacked vertically
                Expanded(child: _buildButtonColumn(blue, _addBlue)),

                const SizedBox(width: 10),

                // Center: round badge
                _buildRoundBadge(),

                const SizedBox(width: 10),

                // Red buttons — stacked vertically
                Expanded(child: _buildButtonColumn(red, _addRed)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildScoreHeader({
    required CompetitorDoc? competitor,
    required int total,
    required Color color,
    required bool isLeft,
  }) {
    final align      = isLeft ? CrossAxisAlignment.start : CrossAxisAlignment.end;
    final textAlign  = isLeft ? TextAlign.left : TextAlign.right;
    final recentChips = (isLeft ? _blueEvents : _redEvents).reversed.take(6).toList();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: align,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'TOTAL SCORE',
            style: TextStyle(
              color: color,
              fontSize: 9,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '$total',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 38,
              fontWeight: FontWeight.w900,
              height: 1.0,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            competitor?.fullName ?? '—',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.65),
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
            overflow: TextOverflow.ellipsis,
            maxLines: 1,
            textAlign: textAlign,
          ),
          if (competitor?.schoolName.isNotEmpty ?? false) ...[
            const SizedBox(height: 2),
            Text(
              competitor!.schoolName,
              style: TextStyle(color: color.withValues(alpha: 0.55), fontSize: 11),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
              textAlign: textAlign,
            ),
          ],
          if (recentChips.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              alignment: isLeft ? WrapAlignment.start : WrapAlignment.end,
              children: recentChips.map((pts) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '+$pts',
                  style: TextStyle(
                    color: color,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              )).toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildButtonColumn(Color color, void Function(int) onAdd) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(child: _ScoreButton(
          label:    '1',
          sublabel: '1 pt',
          color:    color,
          onTap:    () => onAdd(1),
        )),
        const SizedBox(height: 10),
        Expanded(child: _ScoreButton(
          label:    '2',
          sublabel: '2 pts',
          color:    color,
          onTap:    () => onAdd(2),
        )),
      ],
    );
  }

  Widget _buildRoundBadge() {
    const amber = Color(0xFFFFB300);
    final round = _match?.currentRound ?? 1;

    return SizedBox(
      width: 78,
      child: Center(
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 8),
          decoration: BoxDecoration(
            color: amber,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'ROUND',
                style: TextStyle(
                  color: Colors.black,
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.8,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '$round',
                style: const TextStyle(
                  color: Colors.black,
                  fontSize: 52,
                  fontWeight: FontWeight.w900,
                  height: 1.0,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Verification dialog ───────────────────────────────────────────────────────

class _VerificationDialog extends StatelessWidget {
  final String title;
  final String icon;
  final void Function(String verdict) onVote;

  const _VerificationDialog({
    required this.title,
    required this.icon,
    required this.onVote,
  });

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF1A1A1A),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(icon, style: const TextStyle(fontSize: 40)),
            const SizedBox(height: 12),
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            const Text(
              'Select your verdict:',
              style: TextStyle(color: Colors.white54, fontSize: 13),
            ),
            const SizedBox(height: 20),
            _VerdictButton(
              label: 'Valid for RED',
              color: const Color(0xFFEF5350),
              onTap: () => onVote('red'),
            ),
            const SizedBox(height: 10),
            _VerdictButton(
              label: 'Valid for BLUE',
              color: const Color(0xFF42A5F5),
              onTap: () => onVote('blue'),
            ),
            const SizedBox(height: 10),
            _VerdictButton(
              label: 'Invalid',
              color: Colors.white24,
              onTap: () => onVote('invalid'),
            ),
          ],
        ),
      ),
    );
  }
}

class _VerdictButton extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _VerdictButton({required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: color.withValues(alpha: 0.15),
          foregroundColor: color,
          side: BorderSide(color: color.withValues(alpha: 0.5)),
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          elevation: 0,
        ),
        child: Text(
          label,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}

// ── Score button ─────────────────────────────────────────────────────────────

class _ScoreButton extends StatefulWidget {
  final String label;
  final String? sublabel;
  final Color color;
  final VoidCallback? onTap;

  const _ScoreButton({required this.label, this.sublabel, required this.color, required this.onTap});

  @override
  State<_ScoreButton> createState() => _ScoreButtonState();
}

class _ScoreButtonState extends State<_ScoreButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown:   (_) => setState(() => _pressed = true),
      onTapUp:     (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale:    _pressed ? 0.93 : 1.0,
        duration: const Duration(milliseconds: 80),
        curve:    Curves.easeOut,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 80),
          decoration: BoxDecoration(
            color: _pressed
                ? widget.color.withValues(alpha: 0.7)
                : widget.color,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                widget.label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 80,
                  fontWeight: FontWeight.bold,
                  height: 1.0,
                ),
              ),
              if (widget.sublabel != null) ...[
                const SizedBox(height: 4),
                Text(
                  widget.sublabel!,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
