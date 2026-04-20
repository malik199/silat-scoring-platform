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

  // ── Event logs ──────────────────────────────────────────────────────────────
  List<int> _redEvents  = [];
  List<int> _blueEvents = [];

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
        // New match — reload competitors and reset event logs
        final red  = await fetchCompetitor(match.redCompetitorId);
        final blue = await fetchCompetitor(match.blueCompetitorId);
        if (!mounted) return;
        setState(() {
          _match        = match;
          _red          = red;
          _blue         = blue;
          _redEvents    = [];
          _blueEvents   = [];
          _loadingMatch = false;
        });
      } else {
        // Same match — update timer state without resetting scores
        setState(() { _match = match; _loadingMatch = false; });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingMatch = false);
    }
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
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(child: _buildSide(
          color:      Colors.red,
          competitor: _red,
          events:     _redEvents,
          onAdd:      _addRed,
          alignment:  CrossAxisAlignment.start,
        )),
        Container(width: 1, color: Colors.white10),
        Expanded(child: _buildSide(
          color:      Colors.blue,
          competitor: _blue,
          events:     _blueEvents,
          onAdd:      _addBlue,
          alignment:  CrossAxisAlignment.end,
        )),
      ],
    );
  }

  Widget _buildSide({
    required Color color,
    required CompetitorDoc? competitor,
    required List<int> events,
    required void Function(int)? onAdd,
    required CrossAxisAlignment alignment,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Competitor info + event log
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          color: color.withValues(alpha: 0.1),
          child: Column(
            crossAxisAlignment: alignment,
            children: [
              // Competitor name
              Text(
                competitor?.fullName ?? '—',
                style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.bold),
                overflow: TextOverflow.ellipsis,
              ),
              if ((competitor?.schoolName ?? '').isNotEmpty || (competitor?.country ?? '').isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  [
                    if ((competitor?.schoolName ?? '').isNotEmpty) competitor!.schoolName,
                    if ((competitor?.country ?? '').isNotEmpty) competitor!.country,
                  ].join(' · '),
                  style: TextStyle(color: color.withValues(alpha: 0.7), fontSize: 12),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const SizedBox(height: 10),
              // Event chips — fixed height, scrollable, newest first
              SizedBox(
                height: 82,
                child: events.isEmpty
                    ? Align(
                        alignment: alignment == CrossAxisAlignment.end
                            ? Alignment.centerRight
                            : Alignment.centerLeft,
                        child: Text(
                          'No scores yet',
                          style: TextStyle(color: color.withValues(alpha: 0.3), fontSize: 13),
                        ),
                      )
                    : SingleChildScrollView(
                        child: Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          alignment: alignment == CrossAxisAlignment.end
                              ? WrapAlignment.end
                              : WrapAlignment.start,
                          children: events.reversed.map((pts) => Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.25),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: color.withValues(alpha: 0.5)),
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

        // Score buttons
        Expanded(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _ScoreButton(label: '1', color: color, onTap: onAdd != null ? () => onAdd(1) : null)),
                const SizedBox(width: 10),
                Expanded(child: _ScoreButton(label: '2', color: color, onTap: onAdd != null ? () => onAdd(2) : null)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ── Score button ─────────────────────────────────────────────────────────────

class _ScoreButton extends StatefulWidget {
  final String label;
  final Color color;
  final VoidCallback? onTap;

  const _ScoreButton({required this.label, required this.color, required this.onTap});

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
          child: Center(
            child: Text(
              widget.label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 80,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
