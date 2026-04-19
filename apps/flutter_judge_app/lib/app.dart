import 'package:flutter/material.dart';
import 'screens/mode_selection_screen.dart';

class SilatJudgeApp extends StatelessWidget {
  const SilatJudgeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Silat Judge',
      theme: ThemeData.dark(),
      home: const ModeSelectionScreen(),
    );
  }
}
