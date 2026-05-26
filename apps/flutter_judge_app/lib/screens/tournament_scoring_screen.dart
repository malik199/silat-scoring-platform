import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

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

    if (av == null) {
      // Dewan cancelled — dismiss the dialog if it is still on screen
      if (_verificationDialogShowing && mounted) {
        _verificationDialogShowing = false;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) Navigator.of(context).pop();
        });
      }
      return;
    }

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
    final bluePunches = _blueEvents.where((p) => p == 1).length;
    final blueKicks   = _blueEvents.where((p) => p == 2).length;
    final redPunches  = _redEvents.where((p) => p == 1).length;
    final redKicks    = _redEvents.where((p) => p == 2).length;
    final isPhone     = MediaQuery.of(context).size.shortestSide < 600;

    const blue = Color(0xFF42A5F5);
    const red  = Color(0xFFEF5350);

    return Column(
      children: [

        // ── Score headers: compact strip on phones, full cards on tablets ────
        isPhone
            ? _buildCompactStrip(bluePunches, blueKicks, redPunches, redKicks, blue, red)
            : Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 10),
                child: Row(
                  children: [
                    Expanded(child: _buildScoreHeader(
                      competitor: _blue,
                      punches: bluePunches, kicks: blueKicks,
                      color: blue, isLeft: true,
                    )),
                    const SizedBox(width: 10),
                    Expanded(child: _buildScoreHeader(
                      competitor: _red,
                      punches: redPunches, kicks: redKicks,
                      color: red, isLeft: false,
                    )),
                  ],
                ),
              ),

        // ── Buttons + round badge ────────────────────────────────────────────
        Expanded(
          child: Padding(
            padding: EdgeInsets.fromLTRB(20, isPhone ? 4 : 0, 20, 16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _buildButtonColumn(blue, _addBlue)),
                const SizedBox(width: 10),
                _buildRoundBadge(compact: isPhone),
                const SizedBox(width: 10),
                Expanded(child: _buildButtonColumn(red, _addRed)),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCompactStrip(
    int bluePunches, int blueKicks,
    int redPunches,  int redKicks,
    Color blue, Color red,
  ) {
    Widget counts(int punches, int kicks, Color color) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SvgPicture.asset('assets/punch.svg', width: 18, height: 18,
            colorFilter: ColorFilter.mode(color, BlendMode.srcIn)),
        const SizedBox(width: 4),
        Text('$punches', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900, height: 1.0)),
        const SizedBox(width: 10),
        SvgPicture.asset('assets/kick.svg', width: 18, height: 18,
            colorFilter: ColorFilter.mode(color, BlendMode.srcIn)),
        const SizedBox(width: 4),
        Text('$kicks', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900, height: 1.0)),
      ],
    );

    Widget card(String label, String firstName, int punches, int kicks, Color color, bool isLeft) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: isLeft
              ? [
                  Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    Text(label, style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
                    Text(firstName, style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 11), overflow: TextOverflow.ellipsis),
                  ]),
                  const Spacer(),
                  counts(punches, kicks, color),
                ]
              : [
                  counts(punches, kicks, color),
                  const Spacer(),
                  Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
                    Text(label, style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
                    Text(firstName, style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 11), overflow: TextOverflow.ellipsis),
                  ]),
                ],
        ),
      );

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
      child: Row(
        children: [
          Expanded(child: card('BLUE', _blue?.fullName.split(' ').first ?? '—', bluePunches, blueKicks, blue, true)),
          const SizedBox(width: 8),
          Expanded(child: card('RED',  _red?.fullName.split(' ').first  ?? '—', redPunches,  redKicks,  red,  false)),
        ],
      ),
    );
  }

  Widget _buildScoreHeader({
    required CompetitorDoc? competitor,
    required int punches,
    required int kicks,
    required Color color,
    required bool isLeft,
  }) {
    final align     = isLeft ? CrossAxisAlignment.start : CrossAxisAlignment.end;
    final textAlign = isLeft ? TextAlign.left : TextAlign.right;

    Widget countRow(String asset, int count) => Row(
      mainAxisSize: MainAxisSize.min,
      children: isLeft
          ? [
              SvgPicture.asset(asset, width: 18, height: 18,
                  colorFilter: ColorFilter.mode(color, BlendMode.srcIn)),
              const SizedBox(width: 8),
              Text('$count', style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900, height: 1.0)),
            ]
          : [
              Text('$count', style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900, height: 1.0)),
              const SizedBox(width: 8),
              SvgPicture.asset(asset, width: 18, height: 18,
                  colorFilter: ColorFilter.mode(color, BlendMode.srcIn)),
            ],
    );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: align,
        mainAxisSize: MainAxisSize.min,
        children: [
          countRow('assets/punch.svg', punches),
          const SizedBox(height: 8),
          countRow('assets/kick.svg', kicks),
          const SizedBox(height: 8),
          Text(
            competitor?.fullName ?? '—',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.65), fontSize: 13, fontWeight: FontWeight.w600),
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
        ],
      ),
    );
  }

  Widget _buildButtonColumn(Color color, void Function(int) onAdd) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(child: _ScoreButton(
          image:  'assets/punch.svg',
          color:  color,
          onTap:  () => onAdd(1),
        )),
        const SizedBox(height: 10),
        Expanded(child: _ScoreButton(
          image:  'assets/kick.svg',
          color:  color,
          onTap:  () => onAdd(2),
        )),
      ],
    );
  }

  Widget _buildRoundBadge({bool compact = false}) {
    const amber = Color(0xFFFFB300);
    final round = _match?.currentRound ?? 1;
    final size  = compact ? 90.0 : 140.0;

    return SizedBox(
      width: size,
      child: Center(
        child: Container(
          width: size,
          height: size,
          decoration: const BoxDecoration(
            color: amber,
            shape: BoxShape.circle,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (!compact)
                const Text(
                  'ROUND',
                  style: TextStyle(
                    color: Colors.black,
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2,
                    height: 1.0,
                  ),
                ),
              if (!compact) const SizedBox(height: 2),
              Text(
                '$round',
                style: TextStyle(
                  color: Colors.black,
                  fontSize: compact ? 52 : 88,
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
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(icon, style: const TextStyle(fontSize: 28)),
                const SizedBox(width: 10),
                Flexible(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Select your verdict:',
              style: TextStyle(color: Colors.white54, fontSize: 13),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(child: _VerdictButton(
                  label: 'RED',
                  color: const Color(0xFFEF5350),
                  onTap: () => onVote('red'),
                )),
                const SizedBox(width: 8),
                Expanded(child: _VerdictButton(
                  label: 'BLUE',
                  color: const Color(0xFF42A5F5),
                  onTap: () => onVote('blue'),
                )),
                const SizedBox(width: 8),
                Expanded(child: _VerdictButton(
                  label: 'Invalid',
                  color: Colors.white24,
                  onTap: () => onVote('invalid'),
                )),
              ],
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
    return ElevatedButton(
      onPressed: onTap,
      style: ElevatedButton.styleFrom(
        backgroundColor: color.withValues(alpha: 0.15),
        foregroundColor: color,
        side: BorderSide(color: color.withValues(alpha: 0.5)),
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        elevation: 0,
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
        textAlign: TextAlign.center,
      ),
    );
  }
}

// ── Score button ─────────────────────────────────────────────────────────────

class _ScoreButton extends StatefulWidget {
  final String image;
  final Color color;
  final VoidCallback? onTap;

  const _ScoreButton({required this.image, required this.color, required this.onTap});

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
            children: [
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final vPad = constraints.maxHeight * 0.20;
                    return Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16, vertical: vPad),
                      child: SvgPicture.asset(
                        widget.image,
                        fit: BoxFit.contain,
                        colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
