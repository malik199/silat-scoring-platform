import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'config.dart';

const _projectId = 'tanding-scoring';
String get _base => 'http://$emulatorHost:8080/v1/projects/$_projectId/databases/(default)/documents';

/// Unique ID for this judge's session — generated once at app startup.
/// Used to group score events by judge in the Dewan view.
final String judgeSessionId = 'j${DateTime.now().millisecondsSinceEpoch}';


/// A single tournament document with just the fields we need.
class TournamentDoc {
  final String id;
  final String name;
  final String status;
  final Map<String, String> arenaPins;

  const TournamentDoc({
    required this.id,
    required this.name,
    required this.status,
    required this.arenaPins,
  });
}

Future<List<TournamentDoc>> fetchTournaments() async {
  final uri = Uri.parse('$_base/tournaments');
  final response = await http.get(uri);

  if (response.statusCode != 200) {
    throw Exception('Firestore REST error ${response.statusCode}: ${response.body}');
  }

  final body = jsonDecode(response.body) as Map<String, dynamic>;
  final docs  = body['documents'] as List? ?? [];

  return docs.map((doc) {
    final fields = doc['fields'] as Map<String, dynamic>? ?? {};
    final id     = (doc['name'] as String).split('/').last;
    return TournamentDoc(
      id:        id,
      name:      _str(fields, 'name'),
      status:    _str(fields, 'status'),
      arenaPins: _strMap(fields, 'arenaPins'),
    );
  }).toList();
}

class MatchDoc {
  final String id;
  final String redCompetitorId;
  final String blueCompetitorId;
  final String status;
  final bool   timerRunning;

  const MatchDoc({
    required this.id,
    required this.redCompetitorId,
    required this.blueCompetitorId,
    required this.status,
    required this.timerRunning,
  });
}

class CompetitorDoc {
  final String id;
  final String firstName;
  final String lastName;
  final String schoolName;
  final String country;

  const CompetitorDoc({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.schoolName,
    required this.country,
  });

  String get fullName => '$firstName $lastName'.trim();
}

/// Fetches the in_progress match for a given tournament + arena, or null if none.
Future<MatchDoc?> fetchActiveMatch(String tournamentId, int arenaNumber) async {
  final uri = Uri.parse('$_base/matches');
  final response = await http.get(uri);
  debugPrint('=== fetchActiveMatch status: ${response.statusCode}');
  if (response.statusCode != 200) return null;

  final body = jsonDecode(response.body) as Map<String, dynamic>;
  final docs  = body['documents'] as List? ?? [];
  debugPrint('=== matches count: ${docs.length}, looking for tournamentId=$tournamentId arena=$arenaNumber');

  for (final doc in docs) {
    final fields = doc['fields'] as Map<String, dynamic>? ?? {};
    final tId    = _str(fields, 'tournamentId');
    final arena  = int.tryParse((fields['arenaNumber'] as Map?)?['integerValue']?.toString() ?? '') ?? 0;
    final status = _str(fields, 'status');
    debugPrint('  doc: tId=$tId arena=$arena status=$status');
    if (tId == tournamentId && arena == arenaNumber && status == 'in_progress') {
      final timerRunning = (fields['timerRunning'] as Map?)?['booleanValue'] as bool? ?? false;
      return MatchDoc(
        id:               (doc['name'] as String).split('/').last,
        redCompetitorId:  _str(fields, 'redCornerCompetitorId'),
        blueCompetitorId: _str(fields, 'blueCornerCompetitorId'),
        status:           status,
        timerRunning:     timerRunning,
      );
    }
  }
  return null;
}

/// Fetches a single competitor by ID.
Future<CompetitorDoc?> fetchCompetitor(String id) async {
  final uri = Uri.parse('$_base/competitors/$id');
  final response = await http.get(uri);
  if (response.statusCode != 200) return null;

  final fields = (jsonDecode(response.body) as Map<String, dynamic>)['fields']
      as Map<String, dynamic>? ?? {};
  return CompetitorDoc(
    id:         id,
    firstName:  _str(fields, 'firstName'),
    lastName:   _str(fields, 'lastName'),
    schoolName: _str(fields, 'schoolName'),
    country:    _str(fields, 'country'),
  );
}

/// Result of a successful PIN lookup.
class PinMatch {
  final String tournamentId;
  final String tournamentName;
  final int arenaNumber;

  const PinMatch({
    required this.tournamentId,
    required this.tournamentName,
    required this.arenaNumber,
  });
}

/// Scans every tournament for a matching PIN.
/// Returns null if no match is found.
Future<PinMatch?> findArenaByPin(String pin) async {
  final tournaments = await fetchTournaments();
  for (final t in tournaments) {
    for (final entry in t.arenaPins.entries) {
      if (entry.value == pin) {
        final arena = int.tryParse(entry.key);
        if (arena != null) {
          return PinMatch(
            tournamentId:   t.id,
            tournamentName: t.name,
            arenaNumber:    arena,
          );
        }
      }
    }
  }
  return null;
}

/// Writes a single scoring action to the match's scoreEvents subcollection.
/// Fire-and-forget — errors are swallowed so the UI never blocks.
Future<void> postScoreEvent({
  required String matchId,
  required String side,   // "red" | "blue"
  required int    points,
}) async {
  try {
    final uri = Uri.parse('$_base/matches/$matchId/scoreEvents');
    await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'fields': {
          'judgeId':   {'stringValue': judgeSessionId},
          'side':      {'stringValue': side},
          'points':    {'integerValue': points.toString()},
          'createdAt': {'timestampValue': DateTime.now().toUtc().toIso8601String()},
        },
      }),
    );
  } catch (_) {
    // Silent — local score is the source of truth for the judge
  }
}

// ── field helpers ────────────────────────────────────────────────────────────

String _str(Map<String, dynamic> fields, String key) =>
    (fields[key] as Map?)?['stringValue'] as String? ?? '';

Map<String, String> _strMap(Map<String, dynamic> fields, String key) {
  final inner = ((fields[key] as Map?)?['mapValue'] as Map?)?['fields'] as Map? ?? {};
  return inner.map((k, v) => MapEntry(k.toString(), (v as Map?)? ['stringValue']?.toString() ?? ''));
}
