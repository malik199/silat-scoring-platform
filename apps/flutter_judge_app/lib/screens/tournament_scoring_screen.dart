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
  /// The verification ID the judge has already seen/responded to.
  /// When the match's activeVerification.id differs, show the dialog.
  String? _handledVerificationId;
  bool    _verificationDialogShowing = false;

  // ── Event logs ──────────────────────────────────────────────────────────────
  List<int> _redEvents  = [];
  List<int> _blueEvents = [];

  final _redScroll  = ScrollController();
  final _blueScroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _fetchMatch();
    // Poll every 5 s for match changes (new match started, etc.)
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _fetchMatch());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _redScroll.dispose();
    _blueScroll.dispose();
    super.dispose();
  }

  void _scrollToEnd(ScrollController controller) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (controller.hasClients) {
        controller.animateTo(
          controller.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
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
        // New match — reload competitors and reset event logs
        final red  = await fetchCompetitor(match.redCompetitorId);
        final blue = await fetchCompetitor(match.blueCompetitorId);
        if (!mounted) return;
        setState(() {
          _match                  = match;
          _red                    = red;
          _blue                   = blue;
          _redEvents              = [];
          _blueEvents             = [];
          _handledVerificationId  = null;
          _loadingMatch           = false;
        });
      } else {
        // Same match — update timer state without resetting scores
        setState(() { _match = match; _loadingMatch = false; });
      }

      // Check if a new verification request came in
      _checkVerification(match);
    } catch (_) {
      if (mounted) setState(() => _loadingMatch = false);
    }
  }

  void _checkVerification(MatchDoc match) {
    final av = match.activeVerification;
    if (av == null) return;
    if (av.id == _handledVerificationId) return; // already handled
    if (_verificationDialogShowing) return;       // dialog already on screen

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
        title:          title,
        icon:           icon,
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
    _scrollToEnd(_redScroll);
    if (_match != null) {
      postScoreEvent(matchId: _match!.id, side: 'red', points: pts);
    }
  }

  void _addBlue(int pts) {
    setState(() => _blueEvents.add(pts));
    _scrollToEnd(_blueScroll);
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
        toolbarHeight: 70,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${widget.tournamentName}  •  Arena ${widget.arenaNumber}',
              style: const TextStyle(fontSize: 12, color: Colors.white38),
            ),
            const SizedBox(height: 2),
            Text(
              FirebaseAuth.instance.currentUser?.displayName
                  ?? FirebaseAuth.instance.currentUser?.email
                  ?? 'Judge',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
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
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: _buildSide(
            label:      'RED CORNER',
            color:      const Color(0xFFEF5350),
            competitor: _red,
            events:     _redEvents,
            onAdd:      _addRed,
            scrollCtrl: _redScroll,
          )),
          const SizedBox(width: 12),
          Expanded(child: _buildSide(
            label:      'BLUE CORNER',
            color:      const Color(0xFF42A5F5),
            competitor: _blue,
            events:     _blueEvents,
            onAdd:      _addBlue,
            scrollCtrl: _blueScroll,
          )),
        ],
      ),
    );
  }

  Widget _buildSide({
    required String label,
    required Color color,
    required CompetitorDoc? competitor,
    required List<int> events,
    required void Function(int)? onAdd,
    required ScrollController scrollCtrl,
  }) {
    final school  = competitor?.schoolName ?? '';
    final country = competitor?.country    ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [

        // ── Info card ──────────────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withValues(alpha: 0.3), width: 1.5),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [

              // Corner label
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.4,
                ),
              ),
              const SizedBox(height: 6),

              // Competitor name
              Text(
                competitor?.fullName ?? '—',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  height: 1.1,
                ),
                overflow: TextOverflow.ellipsis,
              ),

              // Perguruan + country
              if (school.isNotEmpty || country.isNotEmpty) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    if (school.isNotEmpty) ...[
                      Text(
                        'Perguruan',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.3),
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          school,
                          style: TextStyle(color: color.withValues(alpha: 0.8), fontSize: 13),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ] else
                      Expanded(
                        child: Text(
                          country,
                          style: TextStyle(color: color.withValues(alpha: 0.8), fontSize: 13),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    if (school.isNotEmpty && country.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Text(
                        country,
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.25), fontSize: 12),
                      ),
                    ],
                  ],
                ),
              ],

              const SizedBox(height: 10),

              // Event chips — fixed height, scrollable, newest at end
              SizedBox(
                height: 82,
                child: events.isEmpty
                    ? Center(
                        child: Text(
                          'No scores yet',
                          style: TextStyle(color: color.withValues(alpha: 0.25), fontSize: 13),
                        ),
                      )
                    : SingleChildScrollView(
                        controller: scrollCtrl,
                        child: Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: events.map((pts) => Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: color.withValues(alpha: 0.4)),
                            ),
                            child: Text(
                              '$pts',
                              style: TextStyle(
                                color: color,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          )).toList(),
                        ),
                      ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // ── Score buttons ──────────────────────────────────────────────────
        Expanded(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: _ScoreButton(label: '1', sublabel: '1 pt',  color: color, onTap: onAdd != null ? () => onAdd(1) : null)),
              const SizedBox(width: 10),
              Expanded(child: _ScoreButton(label: '2', sublabel: '2 pts', color: color, onTap: onAdd != null ? () => onAdd(2) : null)),
            ],
          ),
        ),
      ],
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
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp:   (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.93 : 1.0,
        duration: const Duration(milliseconds: 80),
        curve: Curves.easeOut,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 80),
          decoration: BoxDecoration(
            color: _pressed ? widget.color.withValues(alpha: 0.7) : widget.color,
            borderRadius: BorderRadius.circular(16),
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
