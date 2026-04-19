import 'dart:async';
import 'package:flutter/material.dart';

class ScoringLandscape extends StatefulWidget {
  final int arenaNumber;
  final String tournamentId;
  final String tournamentName;

  const ScoringLandscape({
    super.key,
    required this.arenaNumber,
    required this.tournamentId,
    required this.tournamentName,
  });

  @override
  State<ScoringLandscape> createState() => _ScoringLandscapeState();
}

class _ScoringLandscapeState extends State<ScoringLandscape> {
  int _redFinalScore = 0;
  var arrayRedScore = [];
  String _redArrayText = "";
  Color _containerColor = Colors.green;
  var _timer;
  final int _matchTime = 120;
  int _current = 120;

  String _pausePlay = "play";
  final Iterable<Duration> pauses = [
    const Duration(milliseconds: 500),
    const Duration(milliseconds: 1000),
    const Duration(milliseconds: 500),
  ];

  // ****************** RED LOGIC ******************

  void redButtonClicked(numb) {
    //debugPrint(numb);
    setState(() {
      arrayRedScore.add(numb);
      displayRed();
      _redFinalScore = addUpRedScore(arrayRedScore);
    });
  }

  int addUpRedScore(array) {
    if (array.length > 0) {
      return array.reduce((a, b) => a + b);
    } else {
      return 0;
    }
  }

  void displayRed() {
    String text = "";
    arrayRedScore.forEach((element) {
      text += '$element ';
    });
    _redArrayText = text;
    _scrollToBottomRed();
  }

  void _deleteRed() {
    setState(() {
      if (arrayRedScore.length > 0) {
        arrayRedScore.removeLast();
      }
      _redFinalScore = addUpRedScore(arrayRedScore);
      displayRed();
    });
  }

  // ****************** BLUE LOGIC ******************

  int _blueFinalScore = 0;
  var arrayBlueScore = [];
  String _blueArrayText = "";

  void blueButtonClicked(numb) {
    //debugPrint(numb);
    setState(() {
      arrayBlueScore.add(numb);
      displayBlue();
      _blueFinalScore = addUpBlueScore(arrayBlueScore);
    });
  }

  int addUpBlueScore(array) {
    if (array.length > 0) {
      return array.reduce((a, b) => a + b);
    } else {
      return 0;
    }
  }

  void displayBlue() {
    String text = "";
    arrayBlueScore.forEach((element) {
      text += '$element ';
    });
    _blueArrayText = text;
    _scrollToBottomBlue();
  }

  void _deleteBlue() {
    setState(() {
      if (arrayBlueScore.length > 0) {
        arrayBlueScore.removeLast();
      }

      _blueFinalScore = addUpBlueScore(arrayBlueScore);
      displayBlue();
    });
  }

  void resetGame() {
    setState(() {
      _redFinalScore = 0;
      arrayRedScore = [];
      _redArrayText = "";
      _blueFinalScore = 0;
      arrayBlueScore = [];
      _blueArrayText = "";
      _textEditingControllerRed.clear();
      _textEditingControllerBlue.clear();
    });
  }

  // Timer Logic

  IconData getTimerIcon(String pause) {
    if (pause == "pause") {
      return Icons.pause;
    } else {
      return Icons.play_arrow;
    }
  }

  void startTimer(reset) {
    if (_timer != null) {
      // Pause timer
      setState(() {
        _pausePlay = "play";
        _containerColor = Colors.deepOrangeAccent;
      });
      _timer.cancel();
      _timer = null;
    } else {
      if (reset) {
        // Restart timer
        setState(() {
          _pausePlay = "play";
          _containerColor = Colors.green;
          _current = _matchTime;
        });
      } else {
        // Start timer
        _timer = Timer.periodic(
          const Duration(seconds: 1),
          (Timer timer) => setState(
            () {
              _pausePlay = "pause";
              _containerColor = Colors.orange;
              if (_current < 1) {
                timer.cancel();
                _pausePlay = "pause";
                _current = _matchTime;
                _containerColor = Colors.green;
                print("done");
              } else {
                _current = _current - 1;
              }
            },
          ),
        );
      }
    }
  }

  String intToTimeLeft(int value) {
    int h, m, s;
    h = value ~/ 3600;
    m = ((value - h * 3600)) ~/ 60;
    s = value - (h * 3600) - (m * 60);

    /*String hourLeft =
        h.toString().length < 2 ? "0" + h.toString() : h.toString();*/
    String minuteLeft = m.toString();

    // m.toString().length < 2 ? "0" + m.toString() :
    String secondsLeft = s.toString().length < 2 ? "0$s" : s.toString();
    String result = "$minuteLeft:$secondsLeft";

    return result;
  }

  int _selectedIndex = 0;
  static const TextStyle optionStyle =
      TextStyle(fontSize: 30, fontWeight: FontWeight.bold);
  static const List<Widget> _widgetOptions = <Widget>[
    Text(
      'Index 0: Home',
      style: optionStyle,
    ),
    Text(
      'Index 1: Business',
      style: optionStyle,
    ),
    Text(
      'Index 2: School',
      style: optionStyle,
    ),
  ];
  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }
  final ScrollController _scrollControllerRed = ScrollController();
  final ScrollController _scrollControllerBlue = ScrollController();
  // Scroll to the bottom
  void _scrollToBottomRed() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollControllerRed.hasClients) {
        _scrollControllerRed.animateTo(
          _scrollControllerRed.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _scrollToBottomBlue() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollControllerBlue.hasClients) {
        _scrollControllerBlue.animateTo(
          _scrollControllerBlue.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // Delete text in text boxes
  final TextEditingController _textEditingControllerRed = TextEditingController();
  final TextEditingController _textEditingControllerBlue = TextEditingController();

  @override
  void dispose() {
    // Always dispose the controller when it's no longer needed to free up resources.
    _textEditingControllerRed.dispose();
    _textEditingControllerBlue.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const double largeFont = 70;
    const double smallFont = 32;
    const double padding = 10.0;
    const double spacing = 10.0;
    const double middleSpacing = 15.0;
    const double bottomFont = 60;
    const double borderRadius = 8;

    final ButtonStyle redStyle = ButtonStyle(
        shape: MaterialStateProperty.all<RoundedRectangleBorder>(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius),
          ),
        ),
        backgroundColor: MaterialStateProperty.all(Colors.red),
        textStyle: MaterialStateProperty.all(
            const TextStyle(fontSize: largeFont, fontWeight: FontWeight.bold)));
    final ButtonStyle blueStyle = ButtonStyle(
        shape: MaterialStateProperty.all<RoundedRectangleBorder>(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius),
          ),
        ),
        backgroundColor: MaterialStateProperty.all(Colors.blue),
        textStyle: MaterialStateProperty.all(
            const TextStyle(fontSize: largeFont, fontWeight: FontWeight.bold)));
    final ButtonStyle redSmallerStyle = ButtonStyle(
        shape: MaterialStateProperty.all<RoundedRectangleBorder>(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius),
          ),
        ),
        backgroundColor: MaterialStateProperty.all(Colors.red),
        textStyle: MaterialStateProperty.all(
            const TextStyle(fontSize: smallFont, fontWeight: FontWeight.bold)));
    final ButtonStyle blueSmallerStyle = ButtonStyle(
        shape: MaterialStateProperty.all<RoundedRectangleBorder>(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius),
          ),
        ),
        backgroundColor: MaterialStateProperty.all(Colors.blue),
        textStyle: MaterialStateProperty.all(
            const TextStyle(fontSize: smallFont, fontWeight: FontWeight.bold)));
    const TextStyle scoreBoardStyle = TextStyle(
        fontSize: 20, fontWeight: FontWeight.bold, color: Colors.black);

    const TextStyle buttonTextStyle = TextStyle(color: Colors.white);

    return Scaffold(
      appBar: AppBar(
        title: Container(
          padding: const EdgeInsets.symmetric(
              horizontal: 10), // Add padding if needed
          child:  Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _textEditingControllerRed,
                  decoration: const InputDecoration(
                    hintText: 'Add Name For Red Corner...',
                    hintStyle: TextStyle(color: Colors.red),
                    border: InputBorder.none,
                  ),
                  style:
                      const TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 60),
              Expanded(
                child: TextField(
                  controller: _textEditingControllerBlue,
                  decoration: const InputDecoration(
                    hintText: 'Add Name For Blue Corner...',
                    hintStyle: TextStyle(color: Colors.blue),
                    border: InputBorder.none,
                  ),
                  style: const TextStyle(
                      color: Colors.blue, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
        /*actions: [
          IconButton(
            icon: const Icon(Icons.person),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute<ProfileScreen>(
                  builder: (context) => ProfileScreen(
                    appBar: AppBar(
                      title: const Text('User Profile'),
                    ),
                    actions: [
                      SignedOutAction((context) {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => const AuthGate(),
                          ),
                        );
                      })
                    ],
                  ),
                ),
              );
            },
          )
        ],*/
      ),
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(
              height: spacing,
            ),
            Expanded(
              // Scoring #
              flex: 3,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: <Widget>[
                  Expanded(
                    child: Container(
                      color: Colors.white,
                      child: Padding(
                        padding: const EdgeInsets.all(padding),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: SingleChildScrollView(
                            controller: _scrollControllerRed,
                            child: Text(
                              _redArrayText,
                              style: scoreBoardStyle,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(
                    width: middleSpacing,
                  ),
                  Expanded(
                    child: Container(
                      color: Colors.white,
                      child: Padding(
                        padding: const EdgeInsets.all(padding),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: SingleChildScrollView(
                            controller: _scrollControllerBlue,
                            child: Text(
                              _blueArrayText,
                              style: scoreBoardStyle,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(
              height: spacing,
            ),
            Expanded(
              // **** MAIN NUMBERS
              flex: 4,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: <Widget>[
                  Expanded(
                    // The Red Button Set
                    child: Row(
                        //ROW 2
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(
                            child: ElevatedButton(
                              style: redStyle,
                              onPressed: () => redButtonClicked(1),
                              child: const FittedBox(
                                child: Text('1', style: buttonTextStyle),
                              ),
                            ),
                          ),
                          const SizedBox(width: spacing),
                          Expanded(
                            child: ElevatedButton(
                              style: redStyle,
                              onPressed: () => redButtonClicked(2),
                              child: const FittedBox(
                                child: Text('2', style: buttonTextStyle),
                              ),
                            ),
                          ),
                          const SizedBox(width: spacing),
                          Expanded(
                            child: ElevatedButton(
                              style: redStyle,
                              onPressed: () => redButtonClicked(3),
                              child: const FittedBox(
                                child: Text('3', style: buttonTextStyle),
                              ),
                            ),
                          ),
                        ]),
                  ),
                  const SizedBox(
                    width: middleSpacing,
                  ),
                  Expanded(
                    // The Blue Button Set
                    child: Row(
                        //ROW 2
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(
                            child: ElevatedButton(
                              style: blueStyle,
                              onPressed: () => blueButtonClicked(1),
                              child: const FittedBox(
                                child: Text('1', style: buttonTextStyle),
                              ),
                            ),
                          ),
                          const SizedBox(width: spacing),
                          Expanded(
                            child: ElevatedButton(
                              style: blueStyle,
                              onPressed: () => blueButtonClicked(2),
                              child: const FittedBox(
                                child: Text('2', style: buttonTextStyle),
                              ),
                            ),
                          ),
                          const SizedBox(width: spacing),
                          Expanded(
                            child: ElevatedButton(
                              style: blueStyle,
                              onPressed: () => blueButtonClicked(3),
                              child: const FittedBox(
                                child: Text('3', style: buttonTextStyle),
                              ),
                            ),
                          ),
                        ]),
                  ),
                ],
              ),
            ),
            const SizedBox(
              height: spacing,
            ),
            Expanded(
              // **** MINUS NUMBERS
              flex: 4,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: <Widget>[
                  Expanded(
                    // The Red MINUS Button Set
                    child: Row(
                        //ROW 2
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(
                            child: ElevatedButton(
                              style: redSmallerStyle,
                              onPressed: () => redButtonClicked(-1),
                              child: const FittedBox(child: Text('-1', style: buttonTextStyle)),
                            ),
                          ),
                          const SizedBox(width: spacing),
                          Expanded(
                            child: ElevatedButton(
                              style: redSmallerStyle,
                              onPressed: () => redButtonClicked(-2),
                              child: const FittedBox(child: Text('-2', style: buttonTextStyle)),
                            ),
                          ),
                          const SizedBox(width: spacing),
                          Expanded(
                            child: ElevatedButton(
                              style: redSmallerStyle,
                              onPressed: () => redButtonClicked(-5),
                              child: const FittedBox(child: Text('-5', style: buttonTextStyle)),
                            ),
                          ),
                          const SizedBox(width: spacing),
                          Expanded(
                            child: ElevatedButton(
                              style: redSmallerStyle,
                              onPressed: () => redButtonClicked(-10),
                              child: const FittedBox(child: Text('-10', style: buttonTextStyle)),
                            ),
                          ),
                        ]),
                  ),
                  const SizedBox(
                    width: middleSpacing,
                  ),
                  Expanded(
                    // The Blue Button Set
                    child: Row(
                        //ROW 2
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(
                            child: ElevatedButton(
                              style: blueSmallerStyle,
                              onPressed: () => blueButtonClicked(-1),
                              child: const FittedBox(child: Text('-1', style: buttonTextStyle)),
                            ),
                          ),
                          const SizedBox(width: spacing),
                          Expanded(
                            child: ElevatedButton(
                              style: blueSmallerStyle,
                              onPressed: () => blueButtonClicked(-2),
                              child: const FittedBox(child: Text('-2', style: buttonTextStyle)),
                            ),
                          ),
                          const SizedBox(width: spacing),
                          Expanded(
                            child: ElevatedButton(
                              style: blueSmallerStyle,
                              onPressed: () => blueButtonClicked(-5),
                              child: const FittedBox(child: Text('-5', style: buttonTextStyle)),
                            ),
                          ),
                          const SizedBox(width: spacing),
                          Expanded(
                            child: ElevatedButton(
                              style: blueSmallerStyle,
                              onPressed: () => blueButtonClicked(-10),
                              child: const FittedBox(child: Text('-10', style: buttonTextStyle)),
                            ),
                          ),
                        ]),
                  ),
                ],
              ),
            ),
            const SizedBox(
              height: spacing,
            ),
            Expanded(
              // *** OTHERS
              flex: 4,
              child: Row(
                  //ROW 2
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      flex: 1,
                      child: TextButton(
                        onPressed: () {
                          _deleteRed();
                        },
                        child: const Icon(
                          Icons.backspace,
                          color: Colors.red,
                          size: 40.0,
                          semanticLabel:
                              'Text to announce in accessibility modes',
                        ),
                      ),
                    ), // Delete Red
                    const SizedBox(width: spacing),
                    Expanded(
                      flex: 3,
                      child: Container(
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                            border: Border.all(
                              color: Colors.red,
                              width: 4,
                            ),
                            borderRadius: const BorderRadius.all(
                                Radius.circular(borderRadius))),
                        child: FittedBox(
                          child: Text('$_redFinalScore',
                              style: const TextStyle(
                                  fontSize: bottomFont,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white)),
                        ),
                      ),
                    ), // Red Score
                    const SizedBox(width: spacing),
                    Expanded(
                      flex: 4,
                      child: Container(
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _containerColor,
                          borderRadius: const BorderRadius.all(
                            Radius.circular(borderRadius),
                          ),
                        ),
                        child: FittedBox(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            // Adjust as needed
                            children: [
                              FittedBox(
                                child: InkWell(
                                  onTap: () => startTimer(false),
                                  child: Row(
                                    mainAxisSize: MainAxisSize
                                        .min, // Important to constrain the inner Row
                                    children: [
                                      Icon(
                                        getTimerIcon(_pausePlay),
                                        color: Colors.white,
                                        size: 40.0,
                                        semanticLabel: 'Start Timer',
                                      ),
                                      const SizedBox(
                                          width:
                                              8), // Spacing between icon and text, adjust as needed
                                      FittedBox(
                                        child: Text(
                                          intToTimeLeft(_current),
                                          style: const TextStyle(
                                              fontSize: bottomFont,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.white),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              InkWell(
                                onTap: () => startTimer(true),
                                child: const Icon(
                                  Icons.refresh_outlined,
                                  color: Colors.white,
                                  size: 40.0,
                                  semanticLabel: 'Refresh Time',
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ), // Timer

                    ElevatedButton(
                      onPressed: () => showDialog<String>(
                        context: context,
                        builder: (BuildContext context) => AlertDialog(
                          title: const Text('Reset Match?'),
                          content: const Text(
                              'Are you sure you want to reset match and erase all the scores?'),
                          actions: <Widget>[
                            TextButton(
                              onPressed: () => Navigator.pop(context, 'Cancel'),
                              child: const Text('Cancel'),
                            ),
                            TextButton(
                              onPressed: () =>
                                  {Navigator.pop(context, 'OK'), resetGame()},
                              child: const Text('OK'),
                            ),
                          ],
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.purple,
                        shape: const CircleBorder(),
                      ),
                      child: const Icon(
                        Icons.autorenew,
                        size: 40,
                        color: Colors.white,
                      ),
                    ), // Restart

                    Expanded(
                      flex: 3,
                      child: Container(
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                            border: Border.all(
                              color: Colors.blue,
                              width: 4,
                            ),
                            borderRadius: const BorderRadius.all(
                                Radius.circular(borderRadius))),
                        child: FittedBox(
                          child: Text('$_blueFinalScore',
                              style: const TextStyle(
                                  fontSize: bottomFont,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white)),
                        ),
                      ),
                    ), // Blue Score
                    /*const SizedBox(width: spacing),*/
                    Expanded(
                      flex: 1,
                      child: TextButton(
                        onPressed: () {
                          _deleteBlue();
                        },
                        child: const Icon(
                          Icons.backspace,
                          color: Colors.blue,
                          size: 40.0,
                          semanticLabel:
                              'Text to announce in accessibility modes',
                        ),
                      ),
                    ), // Delete Blue
                  ]),
            ),
          ],
        ),
      ),
    );
  }
}
