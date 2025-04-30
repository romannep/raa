//-----------------------------------------------------------------------------
// R's Auto Accompaniment//-----------------------------------------------------------------------------
/*
	Patterns
	- 1-8 - num of note in chord from bottom to top
	- 9 - whole chord
	- 13 - 20 - num of note in chord from bottom to top transposed +octave
	- -11 - -4 - num of note in chord from bottom to top transposed -octave
	- 0 - pause
	- 21+ - exact pitch
	- -(pitch*12 + note) - note in chord from bottom to top transposed down to pitch
	- empty pattern - no repeat, just push

	Items per beat

	Start at beat

	Length of beats

	Threshold = 0.5
*/

var NeedsTimingInfo = true;

var patternValues = [
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
var startThreshold = 0.5; // Notes skip resumes earlier than specified by startThreshold
var chordThreshold = 0.125; // Notes pressed in chordThreshold (from first to last)
// are assumed as a chord and put to activeNotes
var beatStartThreshold = 0.35; // Arpeggiator or repeater first note will not wait for next beat
// and will be fired immediately if it late less than beatStartThreshold

var activeNotes = [];
var playingNotes = [];
var started = false;
var start = 0; // beat position when performance started
var enableFrom = 0;

var activeNotesProcessed = false;
var lastActiveNoteBeatPos = 0;

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

function HandleMIDI(event) {
  if (event instanceof NoteOn) {

    // var enableAt = start + GetParameter("Skip from start of beats");
    // var length = GetParameter("Length of beats");
    // var muteAt = start + length;

    // Trace("start=" + start + " enable at=" + enableAt + " mute at" + muteAt + " curr=" + event.beatPos);


    if (activeNotes.length > 0) {
      var diff = event.beatPos - activeNotes[0].beatPos;
      if (diff > chordThreshold) {
        for (i=0; i < activeNotes.length; i++) {
          var noteOff = new NoteOff(activeNotes[i]);
          noteOff.send();
        }
        activeNotes.length = 0;
      }
    }

    activeNotes.push(new NoteOn(event));
    event.velocity = 0;
    lastActiveNoteBeatPos = event.beatPos;
    activeNotesProcessed = false;

    if (activeNotes.length > 1) {
      activeNotes.sort(sortByPitchAscending);
    }

    if (!started) {
      activeNotes.forEach((note) => {
        if (note.beatPos > start) {
          start = note.beatPos;
        }
      });
      started = true;
    }
  }

}

//-----------------------------------------------------------------------------
var wasPlaying = false;

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
    return noteOn;
  } else {
    var indexAndShift = getNoteIndexAndShift(patternValue);
    if (indexAndShift.index != -1) {
      var noteOn = new NoteOn(playingNotes[indexAndShift.index]);
      noteOn.pitch = noteOn.pitch + indexAndShift.shift;
      return noteOn;
    }
  }
}

function ProcessMIDI() {
  // Get timing information from the host application
  var musicInfo = GetTimingInfo();

  if (wasPlaying && !musicInfo.playing) {
    started = false;
    start = 0;
    enableFrom = 0;
    for (i=0; i < activeNotes.length; i++) {
      var noteOff = new NoteOff(activeNotes[i]);
      noteOff.send();
    }
    activeNotes.length = 0;
    patternNotesCount = 0;
  }

  wasPlaying = musicInfo.playing;

  var enableAt = start + GetParameter("Skip from start of beats");
  var length = GetParameter("Limit length of beats to");
  var muteAt = enableAt + length;

  var blockEnd = musicInfo.blockEndBeat;
  if (started && blockEnd > enableAt - startThreshold
    && (length == 0 || blockEnd < muteAt) ) {

    var blockStart = musicInfo.blockStartBeat;

    var pattern = patternValues[GetParameter("Pattern")];


    if (pattern.length == 0) {
      if (!activeNotesProcessed) {
        activeNotes.forEach((note) => {
          if (!note.sent) {
            noteToPlay = new NoteOn(note);
            noteToPlay.send();
            note.sent = true;
          }
        });
        activeNotesProcessed = true;
      }
    } else {
      // calc needed notes count if pattern changed
      if (patternNotesCount == 0) {
        pattern.forEach((patternValue) => {
          var noteIndex = getNoteIndexAndShift(patternValue).index;
          if (noteIndex + 1 > patternNotesCount) {
            patternNotesCount = noteIndex + 1;
          }
        });
      }

      var initialNote = false;
      // change chord to repeat if can
      if (!activeNotesProcessed && activeNotes.length >= patternNotesCount) {
          playingNotes = activeNotes.slice(0);
          activeNotesProcessed = true;
          initialNote = true;
      }

      var noteLengthPercent = GetParameter("Note length, %");
      var beatShiftPercent = GetParameter("Beat shift, %");
      var shiftedStart = start + 1 * beatShiftPercent / 100;
      var itemsPerBeat = itemsPerBeatValues[GetParameter("Items per bit")];
      var noteLength = 1 / itemsPerBeat * noteLengthPercent / 100;

      var passedBeats = blockStart - shiftedStart;
      var passedStepsInt = Math.floor(passedBeats * itemsPerBeat);
      var nextStepInt = passedStepsInt + 1;
      var nextBeat = shiftedStart + nextStepInt / itemsPerBeat;
      var passedStepIndex = passedStepsInt % pattern.length;
      var nextStepIndex = nextStepInt % pattern.length;

      if (initialNote && nextBeat - passedBeats < beatStartThreshold) {
        var noteOn = getNoteOn(pattern[passedStepIndex]);
        noteOn.send();
        var noteOff = new NoteOff(noteOn);
        noteOff.sendAtBeat(Math.min(blockStart + noteLength, shiftedStart + (passedStepsInt * itemsPerBeat) + noteLength));
      }

      if (blockStart <= nextBeat && nextBeat < blockEnd) {
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


  } else {
    activeNotesProcessed = true;
  }

  if (started && length != 0 && activeNotes.length > 0 && blockEnd > muteAt) {
    // Trace("MMMMMMMmmmmute");
    for (i=0; i < activeNotes.length; i++) {
      var noteOff = new NoteOff(activeNotes[i]);
      noteOff.send();
    }
    activeNotes.length = 0;
  }
  // calculate beat to schedule
  // var nextBeat = Math.ceil(musicInfo.blockStartBeat);

  //if (started && startBeatPosition == 0) {
  //	startBeatPosition = nextBeat - 1;
  //	enableFrom = startBeatPosition + enableAt;
  //	// muteFrom = length == 0 ? 0 : enableFrom + length;
  //}


}



var PluginParameters =
  [
    { name: "Pattern", type:"menu", valueStrings: patternValues.map(p => p.join(",")), defaultValue: 0 },
    { name:"Skip from start of beats", type:"lin",
      minValue:0, maxValue:512, numberOfSteps:512, defaultValue:4 },
    { name:"Limit length of beats to", type:"lin",
      minValue:0, maxValue:512, numberOfSteps:512, defaultValue:8 },
    { name:"Items per bit", type:"menu", valueStrings: itemsPerBeatValues.map(t => t.toString()), defaultValue: 3 },
    { name:"Note length, %", type:"lin",
      minValue:10, maxValue:300, numberOfSteps:29, defaultValue:100 },
    { name:"Beat shift, %", type:"lin",
      minValue:-50, maxValue: 50, numberOfSteps:100, defaultValue:0 },

  ];
