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
    intro: [0, 0, 40, 0, 0, 40, 0, 40],
  },
];

var drumStartedPattern = -1;

var patternValues = [
  [1,0,0,2,9,0,0,0],
  [1, 3, 13, 14, 13, 3],
  [9, 9, 9, 9],
  [],
  [1, 2, 3, 2],
  [1, 2, 3, 2, 13, 3, 2, 3],
  [36, 36, 36, 36],
  [36, 0, 38, 40, 0, 40, 38, 0],
  [-11, 0, 0, 0],
  [0, 0, 9, 0, -(5*12 + 1), -(3*12 + 1), 9, 0 ],
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

function HandleMIDI(event) {
  if (event instanceof NoteOn) {

    if (event.pitch == 24) { // 0
      drumStartedPattern = drumStartedPattern == 0 ? -1 : 0;
      Trace(drumStartedPattern > -1 ? 'Drum started' : 'Drum stopped');
    }

    activeNotes.push(new NoteOn(event));
    
    if (activeNotes.length > 1) {
      activeNotes.sort(sortByPitchAscending);
    }
    checkAndStart(event.beatPos);
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
    var pattern = patternValues[GetParameter("Pattern")];

    var blockStart = musicInfo.blockStartBeat;
    var blockEnd = musicInfo.blockEndBeat;

    var noteLengthPercent = GetParameter("Note length, %");
    var itemsPerBeat = itemsPerBeatValues[GetParameter("Items per bit")];
    var noteLength = 1 / itemsPerBeat * noteLengthPercent / 100;

    var passedBeats = blockStart - start;
    var passedStepsInt = Math.floor(passedBeats * itemsPerBeat);

    if (passedStepsInt < -1) {
      started = false;
    }

    var nextStepInt = passedStepsInt + 1;
    var nextBeat = start + nextStepInt / itemsPerBeat;
    var nextStepIndex = nextStepInt % pattern.length;

    var isDrum = GetParameter('Drum');

    if (blockStart <= nextBeat && nextBeat < blockEnd) {
      // Trace("passedStepsInt=" + passedStepsInt + " nextStepIndex=" + nextStepIndex + " bs=" + blockStart + " start=" + start);
      if (nextStepIndex == pattern.length - 1) {
        started = false;
        checkAndStart(nextBeat + noteLength);
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
          var drumPattern = drumPatterns[drumStartedPattern].pattern;
          var noteOn = new NoteOn();
          var nextPitch = drumPattern[nextStepIndex];
          noteOn.pitch = nextPitch;
          noteOn.velocity = 120;
          if (noteOn) {
            noteOn.sendAtBeat(nextBeat);
            var noteOff = new NoteOff(noteOn);
            noteOff.sendAtBeat(nextBeat + noteLength);
          }
        }
      } else {
        if (pattern[nextStepIndex] == 9) {
          playingNotes.forEach((n) => {
            var noteOn = new NoteOn(n);
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



var PluginParameters =
  [
    { name: "Drum", type: "checkbox", defaultValue: 0 },
    { name: "Pattern", type:"menu", valueStrings: patternValues.map(p => p.join(",")), defaultValue: 0 },
    { name:"Items per bit", type:"menu", valueStrings: itemsPerBeatValues.map(t => t.toString()), defaultValue: 3 },
    { name:"Note length, %", type:"lin",
      minValue:10, maxValue:300, numberOfSteps:29, defaultValue:100 },
  ];
