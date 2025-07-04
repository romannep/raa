//-----------------------------------------------------------------------------
// Roman's Arpeggiator//-----------------------------------------------------------------------------
/*
	Patterns
	- 1-8 - num of note in chord from bottom to top
	- 9 - whole chord
	- 13 - 20 - num of note in chord from bottom to top transposed +octave
	- -11 - -4 - num of note in chord from bottom to top transposed -octave
	- 0 - pause
	- 21+ - exact pitch - C in C1 == 24
	- -(pitch*12 + note) - note in chord from bottom to top transposed down to pitch
*/

var NeedsTimingInfo = true;

// var drumPatterns = [
//   {
//     pattern: [36, 0, 0, 0, 40, 0, 0, 0],
//     intro: [ 0, 0, 0, 0, 0, 0, 0, 0, 40, 0, 40, 0, 0],
//   },
//   {
//     pattern: [36, 0, 0, 40, 0, 36, 36, 0, 0, 40, 0, 0],
//     pattern2: [42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42],
//   },
//   {
//     pattern: [36, 0, 40, 36, 0, 0, 40, 0],
//     pattern2: [42, 42, 42, 42, 42, 42, 42, 42],
//   },
//   {
//     pattern: [36, 0, 40, 0, 36, 0, 40, 0],
//     pattern2: [42, 42, 42, 42, 42, 42, 42, 42],
//   },
// ];

// var patternValues = [
//   [1,0,0,0,9,0,0,0],
//   [9,0,0,0,9,0,0,0],
//   [1,0,0,0,1,0,0,0],
//   [1, 3, 13, 14, 13, 3],
//   [9, 9, 9, 9],
// ];

var itemsPerBeatValues = [0.125, 0.25, 0.5, 1, 2, 4, 8];
var activeNotes = []; // Currently pressed keys
var playingNotes = [];// To play when hand not holds keys
var started = false;
var start = 0; // beat position when performance started
var notesCountToStart = 3;

function getNoteIndexAndShift(patternValue) { // 0-7 - note index, -1 - chord
  if (patternValue > 0 && patternValue < 9) {
    return { index: patternValue -1, shift: 0 };
  }
  if (patternValue == 9) {
    return { index: -1, shift: 0 };
  }
  if (patternValue > 12 && patternValue < 20) {
    return { index: patternValue - 12, shift: 12 };
  }
  if (patternValue > -12 && patternValue < -3) {
    return { index: patternValue + 12, shift: -12 };
  }
  if (patternValue < -11) {
    var pitch = Math.ceil(patternValue / 12);
    return { index: 0 - (patternValue % 12) -  1, shift: pitch };
  }
  return { index: -1, shift: 0 };
}

function checkAndStart(beatPos) {
  if (activeNotes.length >= notesCountToStart && !started) {
    started = true;
    start = beatPos;
    playingNotes = activeNotes.slice(0); 
    Trace('started set true s=' + start);
  }
}

var drumIntro = false;

function HandleMIDI(event) {
  if (event instanceof NoteOn) {
    Trace("Pushed key with pitch " + event.pitch);
    var isAccompaniment = GetParameter('Stop on keys release') == 0;
    if (isAccompaniment) {
      if (event.pitch == GetParameter('Start key pitch')) {
        if (!started) {
          started = true;
          start = event.beatPos;
          Trace("Started acc by key");
        } else {
          started = false;
          Trace("Stopped acc by key");
        }
      }
    } else {
      activeNotes.push(new NoteOn(event));
      
      if (activeNotes.length > 1) {
        activeNotes.sort(sortByPitchAscending);
      }
      checkAndStart(event.beatPos);
    }
    // Trace("noteOn pitch=" + event.pitch + " now active: " + activeNotes.length + " started=" + started );
  }

  if (event instanceof NoteOff) {
    var noteIndex = activeNotes.findIndex(n => n.pitch == event.pitch);
    if (noteIndex > -1) {
      activeNotes.splice(noteIndex, 1);
    }
  }

}


function sortByPitchAscending(a,b) {
  if (a.pitch < b.pitch) return -1;
  if (a.pitch > b.pitch) return 1;
  return 0;
}

var patternNotesCount = 0;

function getNoteOn(patternValue) {
  if (patternValue > 20) {
    var noteOn = new NoteOn;
    noteOn.pitch = patternValue;
    noteOn.velocity = 120;
    return noteOn;
  } else {
    var indexAndShift = getNoteIndexAndShift(patternValue);
    if (indexAndShift.index != -1) {
      var noteOn = new NoteOn(playingNotes[indexAndShift.index]);
      noteOn.pitch = noteOn.pitch + indexAndShift.shift;
      noteOn.velocity = 120;
      return noteOn;
    }
  }
}

var patternData = {};

function ProcessMIDI() {
  var musicInfo = GetTimingInfo();

  if (started) {
    var isAccompaniment = GetParameter('Stop on keys release') == 0;

    // var pattern = patternValues[GetParameter("Pattern")];

    // if (isAccompaniment) {
    //   pattern = drumIntro ? drumPatterns[drumStartedPattern].intro : drumPatterns[drumStartedPattern].pattern;
    // }

    var blockStart = musicInfo.blockStartBeat;
    var blockEnd = musicInfo.blockEndBeat;

    // var noteLengthPercent = GetParameter("Note length, %");
    var itemsPerBeat = itemsPerBeatValues[GetParameter("Items per bit")];
    // var noteLength = 1 / itemsPerBeat * noteLengthPercent / 100;
	  var noteLength = 1 / itemsPerBeat;
    
    var beatShiftPercent = 0; // Legacy // GetParameter("Beat shift, %");
    var startShift = 1 * beatShiftPercent / 100;
    var shiftedStart = start + startShift;
    var passedBeats = blockStart - shiftedStart;
    var passedStepsInt = Math.floor(passedBeats * itemsPerBeat);

    if (passedStepsInt < -1) {
      started = false;
    }

    var patternLength = GetParameter("Pattern length");

    var nextStepInt = passedStepsInt + 1;
    var nextBeat = shiftedStart + nextStepInt / itemsPerBeat;
    // var drumIntroPassedbeats = isAccompaniment && !drumIntro && !!drumPatterns[drumStartedPattern].intro ? drumPatterns[drumStartedPattern].intro.length : 0;
    // var nextStepIndex = (nextStepInt - drumIntroPassedbeats) % pattern.length;
    var nextStepIndex = nextStepInt % patternLength;

    if (blockStart <= nextBeat && nextBeat < blockEnd) {
      // Trace("passedStepsInt=" + passedStepsInt + " nextStepIndex=" + nextStepIndex + " bs=" + blockStart + " start=" + start + "drum intro" + drumIntro);
      if (isAccompaniment) {
        // Do nothing 

        // Legacy
        // if (nextStepIndex == pattern.length - 1) {
        //   if (drumIntro) {
        //     drumIntro = false;
        //   }
        // }  
      } else {
        if (nextStepIndex == patternLength - 1) {
          started = false;
          checkAndStart(nextBeat + noteLength - startShift);
        }  
      }

      // var noteLengthMultiplicator = 1;
      // var futureStepIndex = nextStepIndex + 1;
      // while (futureStepIndex < pattern.length - 1 && pattern[futureStepIndex] == 0) {
      //   noteLengthMultiplicator += 1;
      //   futureStepIndex += 1;
      // }
      // noteLength = noteLength * noteLengthMultiplicator;
      
      var notesToPlay = patternData[nextStepIndex];
      if (notesToPlay && notesToPlay.length) {
        for (var i = 0; i < notesToPlay.length; i++) {
          var noteToPlay = notesToPlay[i];
          var noteOn = new NoteOn();
          noteOn.velocity = 120;
          if (noteToPlay.type == "Pitch") {
            noteOn.pitch = noteToPlay.pitch;
          } else { //number
            var indexAndShift = getNoteIndexAndShift(noteToPlay.num);
            if (indexAndShift.index != -1) {
              var noteOn = new NoteOn(playingNotes[indexAndShift.index]);
              noteOn.pitch = noteOn.pitch + indexAndShift.shift;
            }
          }
          noteOn.sendAtBeat(nextBeat);
          var noteOff = new NoteOff(noteOn);
          noteOff.sendAtBeat(nextBeat + noteLength * noteToPlay.length);
        }

      }

      // if (isAccompaniment) {
      //   if (drumStartedPattern > -1) {
      //     var noteOn = new NoteOn();
      //     var nextPitch = pattern[nextStepIndex];
      //     noteOn.pitch = nextPitch;
      //     noteOn.velocity = 120;
      //     if (noteOn) {
      //       noteOn.sendAtBeat(nextBeat);
      //       var noteOff = new NoteOff(noteOn);
      //       noteOff.sendAtBeat(nextBeat + noteLength);
      //     }
      //     if (!drumIntro && drumPatterns[drumStartedPattern].pattern2) {
      //       var noteOn = new NoteOn();
      //       var nextPitch = drumPatterns[drumStartedPattern].pattern2[nextStepIndex];
      //       noteOn.pitch = nextPitch;
      //       noteOn.velocity = 120;
      //       if (noteOn) {
      //         noteOn.sendAtBeat(nextBeat);
      //         var noteOff = new NoteOff(noteOn);
      //         noteOff.sendAtBeat(nextBeat + noteLength);
      //       }
      //     }
      //   }
      // } else {
      //   if (pattern[nextStepIndex] == 9) {
      //     playingNotes.forEach((n) => {
      //       var noteOn = new NoteOn(n);
      //       noteOn.velocity = 120;
      //       noteOn.sendAtBeat(nextBeat);
      //       var noteOff = new NoteOff(noteOn);
      //       noteOff.sendAtBeat(nextBeat + noteLength);
      //     });
      //   } else {
      //     var noteOn = getNoteOn(pattern[nextStepIndex]);
      //     if (noteOn) {
      //       noteOn.sendAtBeat(nextBeat);
      //       var noteOff = new NoteOff(noteOn);
      //       noteOff.sendAtBeat(nextBeat + noteLength);
      //     }
      //   }
      // }
    }

  }

}


var BaseParameters = [
  { name: "Stop on keys release", type:"checkbox", defaultValue:1 },
  { name: "Start key pitch", type: "lin", minValue: -24, maxValue: 120, numberOfSteps: 144, defaultValue: 24 },
  { name: "Pattern length", type:"lin", minValue:2, maxValue:16, numberOfSteps:14, defaultValue:4 },
  { name :"Items per bit", type:"menu", valueStrings: itemsPerBeatValues.map(t => t.toString()), defaultValue: 3 },
];

// TODO: Normalized chord index. One pattern can be used for differntly transposed chords.
var KeyParamters = [
  { name: 'Note', type: "text" },
  { name: "Type", type:"menu", valueStrings: ["Number", "Pitch"], defaultValue: 0 }, 
  { name: "Step", type:"lin", minValue:1, maxValue:16, numberOfSteps:15, defaultValue: 0 },
  { name: "Note length, steps", type:"lin", minValue:1, maxValue:16, numberOfSteps:15, defaultValue:1 },
  { name: "Note number", type: "lin", minValue: 0, maxValue: 9, numberOfSteps: 9, defaultValue: 0 }, // 9 - for whole chord
  { name: "Note pitch", type: "lin", minValue: 0, maxValue: 120, numberOfSteps: 120, defaultValue: 0 },
];


var stepNotes = [];
for (let i = 0; i < 20; i++) {
  stepNotes.push(0);
}

// UI

function stepNoteParamName(paramName, groupIndex) {
  return "(" + (groupIndex+1) + ") " + paramName;
}

// var paramsChanged = false;

// function Idle () {

//   if (paramsChanged) {
//     PluginParameters = [].concat(BaseParameters);

//     for (var i = 0; i < stepNotes.length; i++) {

//       var noteParameters = KeyParamters.map(a => Object.assign({}, a));
//       noteParameters.forEach(p => {
//         p.name = stepNoteParamName(p.name, i);
//       });

//       PluginParameters = PluginParameters.concat(noteParameters);
//     }

//     Trace('Do update parameters');
//     UpdatePluginParameters();

//     paramsChanged = false;
//   }

// }

function fillPatternData() {
  patternData = {};
  for (noteIndex = 0; noteIndex < stepNotes.length; noteIndex++) {
    var type = GetParameter(stepNoteParamName("Type", noteIndex));
    var num = GetParameter(stepNoteParamName("Note number", noteIndex));
    var pitch = GetParameter(stepNoteParamName("Note pitch", noteIndex));
    var step = GetParameter(stepNoteParamName("Step", noteIndex));
    
    if (noteIndex < 5) {
      Trace("Note " + noteIndex + " type " + type + " num " + num + " pitch " + pitch);
    }
    if ((type == 0 && num > 0) || (type == 1 && pitch > 0)) {
      Trace("Do add to step " + step);
      var patternStepData = patternData['step' + step] || [];
      patternStepData.push({
        type: type,
        num: num,
        pitch: pitch,
        length: GetParameter(stepNoteParamName("Note length, steps", noteIndex)),
      });
    }
    patternData['step' + step] = patternStepData;
  }
  Trace('Pattern data ' + Object.keys(patternData).map((d, index) => '' + d + ' ' + (patternData[d] ? patternData[d].length : 0) + ';'));
}

function ParameterChanged(param, value) {
  // Trace('P changed ' + param + " v " + value);
	// if (param >= BaseParameters.length) {
  //   var relativeIndex = param - BaseParameters.length;
  //   var groupIndex = Math.floor((relativeIndex)/(KeyParamters.length + 1));
  //   var keyParameterIndex = relativeIndex - groupIndex * (KeyParamters.length + 1);
  //   if (keyParameterIndex == 1 && stepNotes[groupIndex] != value) {
  //     stepNotes[groupIndex] = value;
  //     paramsChanged = true;
  //   }

  //   // fillPatternData();
  // }
  fillPatternData();

}

var PluginParameters = [].concat(BaseParameters);
for (var i = 0; i < stepNotes.length; i++) {

  var noteParameters = KeyParamters.map(a => Object.assign({}, a));
  noteParameters.forEach(p => {
    p.name = stepNoteParamName(p.name, i);
  });

  PluginParameters = PluginParameters.concat(noteParameters);
}

    // { name:"Stop on keys release", type:"checkbox", defaultValue:1 },
    // { name:"Pattern length", type:"lin",
    //   minValue:2, maxValue:16, numberOfSteps:14, defaultValue:4 },
    // { name: "Add", type: "momentary" },
    // { name: "Remove last", type: "momentary" },
  
    // { name: "Pattern", type:"menu", valueStrings: patternValues.map(p => p.join(",")), defaultValue: 0 },
    // { name:"Items per bit", type:"menu", valueStrings: itemsPerBeatValues.map(t => t.toString()), defaultValue: 3 },
    // { name:"Note length, %", type:"lin",
    //   minValue:10, maxValue:300, numberOfSteps:29, defaultValue:100 },
    // { name:"Beat shift, %", type:"lin",
    //   minValue:-15, maxValue: 15, numberOfSteps:30, defaultValue:0 },
    // { name: "Drum", type: "checkbox", defaultValue: 0 },
    // { name: "Drum Pattern", type:"menu", valueStrings: drumPatterns.map(p => p.pattern.join(",")), defaultValue: 0 },
