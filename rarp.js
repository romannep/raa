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

var drumPatterns = [
  {
    pattern: [36, 0, 0, 0, 40, 0, 0, 0],
    intro: [ 0, 0, 0, 0, 0, 0, 0, 0, 40, 0, 40, 0, 0],
  },
  {
    pattern: [36, 0, 0, 40, 0, 36, 36, 0, 0, 40, 0, 0],
    pattern2: [42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42],
  },
  {
    pattern: [36, 0, 40, 36, 0, 0, 40, 0],
    pattern2: [42, 42, 42, 42, 42, 42, 42, 42],
  },
  {
    pattern: [36, 0, 40, 0, 36, 0, 40, 0],
    pattern2: [42, 42, 42, 42, 42, 42, 42, 42],
  },
];

var drumStartedPattern = -1;

var patternValues = [
  [1,0,0,0,9,0,0,0],
  [9,0,0,0,9,0,0,0],
  [1,0,0,0,1,0,0,0],
  [1, 3, 13, 14, 13, 3],
  [9, 9, 9, 9],
];
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

    var isDrum = GetParameter('Drum');
    if (isDrum) {
      if (event.pitch == 24) { // 0
        drumStartedPattern = drumStartedPattern == -1 ? GetParameter('Drum Pattern') : -1;
        Trace(drumStartedPattern > -1 ? 'Drum started ' + drumStartedPattern : 'Drum stopped');
        if (drumStartedPattern > -1) {
          drumIntro = !!drumPatterns[drumStartedPattern].intro;
          started = true;
          start = event.beatPos;
        } else {
          started = false;
        }
      }
    } else {
      activeNotes.push(new NoteOn(event));
      
      if (activeNotes.length > 1) {
        activeNotes.sort(sortByPitchAscending);
      }
      checkAndStart(event.beatPos);
    }


    Trace("noteOn pitch=" + event.pitch + " now active: " + activeNotes.length + " started=" + started );
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

function ProcessMIDI() {
  var musicInfo = GetTimingInfo();

  if (started) {
    var isDrum = GetParameter('Drum');

    var pattern = patternValues[GetParameter("Pattern")];
    if (isDrum) {
      pattern = drumIntro ? drumPatterns[drumStartedPattern].intro : drumPatterns[drumStartedPattern].pattern;
    }

    var blockStart = musicInfo.blockStartBeat;
    var blockEnd = musicInfo.blockEndBeat;

    var noteLengthPercent = GetParameter("Note length, %");
    var itemsPerBeat = itemsPerBeatValues[GetParameter("Items per bit")];
    var noteLength = 1 / itemsPerBeat * noteLengthPercent / 100;
	
    var beatShiftPercent = GetParameter("Beat shift, %");
    var startShift = 1 * beatShiftPercent / 100;
    var shiftedStart = start + startShift;
    var passedBeats = blockStart - shiftedStart;
    var passedStepsInt = Math.floor(passedBeats * itemsPerBeat);

    if (passedStepsInt < -1) {
      started = false;
    }

    var nextStepInt = passedStepsInt + 1;
    var nextBeat = shiftedStart + nextStepInt / itemsPerBeat;
    var drumIntroPassedbeats = isDrum && !drumIntro && !!drumPatterns[drumStartedPattern].intro ? drumPatterns[drumStartedPattern].intro.length : 0;
    var nextStepIndex = (nextStepInt - drumIntroPassedbeats) % pattern.length;

    if (blockStart <= nextBeat && nextBeat < blockEnd) {
      Trace("passedStepsInt=" + passedStepsInt + " nextStepIndex=" + nextStepIndex + " bs=" + blockStart + " start=" + start + "drum intro" + drumIntro);
      if (isDrum) {
        if (nextStepIndex == pattern.length - 1) {
          if (drumIntro) {
            drumIntro = false;
          }
        }  
      } else {
        if (nextStepIndex == pattern.length - 1) {
          started = false;
          checkAndStart(nextBeat + noteLength - startShift);
        }  
      }

      var noteLengthMultiplicator = 1;
      var futureStepIndex = nextStepIndex + 1;
      while (futureStepIndex < pattern.length - 1 && pattern[futureStepIndex] == 0) {
        noteLengthMultiplicator += 1;
        futureStepIndex += 1;
      }
      noteLength = noteLength * noteLengthMultiplicator;
      
      if (isDrum) {
        if (drumStartedPattern > -1) {
          var noteOn = new NoteOn();
          var nextPitch = pattern[nextStepIndex];
          noteOn.pitch = nextPitch;
          noteOn.velocity = 120;
          if (noteOn) {
            noteOn.sendAtBeat(nextBeat);
            var noteOff = new NoteOff(noteOn);
            noteOff.sendAtBeat(nextBeat + noteLength);
          }
          if (!drumIntro && drumPatterns[drumStartedPattern].pattern2) {
            var noteOn = new NoteOn();
            var nextPitch = drumPatterns[drumStartedPattern].pattern2[nextStepIndex];
            noteOn.pitch = nextPitch;
            noteOn.velocity = 120;
            if (noteOn) {
              noteOn.sendAtBeat(nextBeat);
              var noteOff = new NoteOff(noteOn);
              noteOff.sendAtBeat(nextBeat + noteLength);
            }
          }
        }
      } else {
        if (pattern[nextStepIndex] == 9) {
          playingNotes.forEach((n) => {
            var noteOn = new NoteOn(n);
            noteOn.velocity = 120;
            noteOn.sendAtBeat(nextBeat);
            var noteOff = new NoteOff(noteOn);
            noteOff.sendAtBeat(nextBeat + noteLength);
          });
        } else {
          var noteOn = getNoteOn(pattern[nextStepIndex]);
          if (noteOn) {
            noteOn.sendAtBeat(nextBeat);
            var noteOff = new NoteOff(noteOn);
            noteOff.sendAtBeat(nextBeat + noteLength);
          }
        }
      }
    }

  }

}

var ModeSwitcherParameter = { name:"Stop on keys release", type:"checkbox", defaultValue:1 };
var StartKeyPitchParameter = { name: "Start key pitch", type: "lin", minValue: -24, maxValue: 120, numberOfSteps: 144, defaultValue: 24 };

var BaseParameters = [
    { name:"Pattern length", type:"lin", minValue:2, maxValue:16, numberOfSteps:14, defaultValue:4 },
    { name:"Items per bit", type:"menu", valueStrings: itemsPerBeatValues.map(t => t.toString()), defaultValue: 3 },
    { name: "Add", type: "momentary" },
    { name: "Remove last", type: "momentary" },
];

// TODO: Normalized chord index. One pattern can be used for differntly transposed chords.
var KeyParamters = [
  { name: 'Note', type: "text" },
  { name: "Type", type:"menu", valueStrings: ["Number", "Pitch"], defaultValue: 0 }, 
  { name: "Note length, steps", type:"lin", minValue:1, maxValue:16, numberOfSteps:16, defaultValue:1 },
];
var KeyParameterPitch = { name: "Note pitch", type: "lin", minValue: -24, maxValue: 120, numberOfSteps: 144, defaultValue: 24 };
// 9 - for whole chord
var KeyParameterNumber = { name: "Note number", type: "lin", minValue: 1, maxValue: 9, numberOfSteps: 9, defaultValue: 1 };

var stepNotes = [];

// UI

var paramsChanged = false;

var groupsCound = 0;

function Idle () {

  if (paramsChanged) {
    var stopOnRelease = GetParameter("Stop on keys release");
    PluginParameters = [ModeSwitcherParameter];
    if (stopOnRelease == 0) {
      PluginParameters.push(StartKeyPitchParameter);
    }
    PluginParameters = PluginParameters.concat(BaseParameters);

    for (var i = 0; i < stepNotes.length; i++) {
      var stepNote = stepNotes[i];
      var noteParameters = KeyParamters.map(a => Object.assign({}, a));
      noteParameters.forEach(p => {
        p.name = "(" + i + ") " + p.name;
      });
      noteType = GetParameter("(" + i + ") Type");
      if (noteType == "Number") {
        noteParameters.push(KeyParameterNumber);
      } else {
        noteParameters.push(KeyParameterPitch);
      }
      p = noteParameters[noteParameters.length - 1];
      p.name = "(" + i + ") " + p.name;
      PluginParameters = PluginParameters.concat(noteParameters);
    }

    Trace('Do update parameters');
    UpdatePluginParameters();

    paramsChanged = false;
  }

}

var ParamStopOnRelease = 1;

function ParameterChanged(param, value) {
	Trace('Changed ' + param + ' to ' + value);
  if (param == 0 && value != ParamStopOnRelease) {
    ParamStopOnRelease = value;
    paramsChanged = true;
  } else {
    var baseParamIndex = param - 1 - (GetParameter("Stop on keys release") == 0 ? 1 : 0);

    if (baseParamIndex == 2) {
      stepNotes.push({ type: 'Number' });
      paramsChanged = true;
    } else if (baseParamIndex == 3) {
      stepNotes.pop();
      paramsChanged = true;
    }
  }

}

var PluginParameters = [ModeSwitcherParameter].concat(BaseParameters);
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
