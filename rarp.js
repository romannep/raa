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
    // Trace('started set true s=' + start);
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

    var blockStart = musicInfo.blockStartBeat;
    var blockEnd = musicInfo.blockEndBeat;

    var itemsPerBeat = itemsPerBeatValues[GetParameter("Items per bit")];
	  var noteLength = 1 / itemsPerBeat;
    
    var passedBeats = blockStart - start;
    var passedStepsInt = Math.floor(passedBeats * itemsPerBeat);

    var delta = blockEnd - blockStart;
    if (Math.abs(passedBeats) < delta) { // Initial start
      passedStepsInt = -1;
    }


    var patternLength = GetParameter("Pattern length");

    var nextStepInt = passedStepsInt + 1;
    var nextBeat = start + nextStepInt / itemsPerBeat;
    var nextStepIndex = nextStepInt % patternLength;

    if ((blockStart <= nextBeat && nextBeat < blockEnd)) {
      // Trace("passedStepsInt=" + passedStepsInt + " nextStepIndex=" + nextStepIndex + " bs=" + blockStart + " start=" + start + "drum intro" + drumIntro);
      if (!isAccompaniment) {
        if (nextStepIndex == patternLength - 1) {
          started = false;
          checkAndStart(nextBeat + noteLength);
        }  
      }
      
      var notesToPlay = patternData['step' + (nextStepIndex + 1)];
      Trace('index ' + nextStepIndex + ' step ' + 'step' + (nextStepIndex + 1) + ' notes ' + JSON.stringify(notesToPlay) );
      if (notesToPlay && notesToPlay.length) {
        for (var i = 0; i < notesToPlay.length; i++) {
          var noteToPlay = notesToPlay[i];
          Trace('will play ' + JSON.stringify(noteToPlay));
          var notesToSend = [];
          if (noteToPlay.type == 1) { // pitch
            var noteOn = new NoteOn();
            noteOn.velocity = 120;
            noteOn.pitch = noteToPlay.pitch;
            notesToSend.push(noteOn);
          } else { //number
            if (noteToPlay.num == 9) {
              playingNotes.forEach((note) => {
                var noteOn = new NoteOn();
                noteOn.velocity = 120;
                noteOn.pitch = note.pitch;
                noteOn.isRealtime = true;
                notesToSend.push(noteOn);
              });
            } else {
              var indexAndShift = getNoteIndexAndShift(noteToPlay.num);
              if (indexAndShift.index != -1) {
                var noteOn = new NoteOn();
                noteOn.velocity = 120;
                noteOn.pitch = playingNotes[indexAndShift.index].pitch + indexAndShift.shift;
                noteOn.isRealtime = true;
                notesToSend.push(noteOn);
              }

            }
          }
          notesToSend.forEach((noteOn) => {
            noteOn.sendAtBeat(nextBeat);
            var noteOff = new NoteOff(noteOn);
            noteOff.sendAtBeat(nextBeat + noteLength * noteToPlay.length);
          });
        }

      }

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
  { name: "Step", type:"lin", minValue:0, maxValue:16, numberOfSteps:16, defaultValue: 0 },
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

function fillPatternData() {
  patternData = {};
  for (noteIndex = 0; noteIndex < stepNotes.length; noteIndex++) {
    var type = GetParameter(stepNoteParamName("Type", noteIndex));
    var num = GetParameter(stepNoteParamName("Note number", noteIndex));
    var pitch = GetParameter(stepNoteParamName("Note pitch", noteIndex));
    var step = GetParameter(stepNoteParamName("Step", noteIndex));
    
    if (step > 0) {
      var patternStepData = patternData['step' + step] || [];
      patternStepData.push({
        type: type,
        num: num,
        pitch: pitch,
        length: GetParameter(stepNoteParamName("Note length, steps", noteIndex)),
      });
      patternData['step' + step] = patternStepData;
    }
  }
  Trace('Pattern data ' + JSON.stringify(patternData));
}

function ParameterChanged(param, value) {
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
fillPatternData();

