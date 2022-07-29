/******************************************************************************/
/*** Preamble ************************************************/
/******************************************************************************/

/*
Interaction based on dyadic_interaction_p2p.
*/

/******************************************************************************/
/*** Global variables *********************************************************/
/******************************************************************************/

/*
 */

//needed for submission by redirect at end
var PROLIFIC_COMPLETION_CODE = "XXXXXXXX"; 

//port for the server running the turn-taking procedure
//this assumes a particular naming convention we use for secure web socket ports
//at Edinburgh, you may need to tweak this and the place it is used 
//in dyadic_interaction_utilities.js
var main_port_number = "ws25"; 

//maximum number of errors in warmup trials - more than this leads to non-progression
var max_warmup_errors = 1;

//maximum number of errors in colour test trials - more than this leads to non-progression
var max_colour_errors = 0;

//max wait to be paired, in minutes
var max_wait = 5; 

//to show progres and check progression criteria at crucial points
var PROGRESSION_COUNTER = { current_trial: 1, max_trial: 0, correct: 0 }; 

//could be over-written e.g. if the participant fails a catch trial
var EXIT_MODE = "completed"; 

//over-written when headers are written for the first time
var HEADERS_WRITTEN = false; 


/******************************************************************************/
/*** Retrieve participant ID *****************************************/
/******************************************************************************/

/*
Running on Prolific, so can access PROLIFIC_ID as follows.
*/

var PARTICIPANT_ID = jsPsych.data.getURLVariable("PROLIFIC_PID");

/******************************************************************************/
/*** Saving data  ***********************************************/
/******************************************************************************/

/*
This is a modified version of our usual save_data function - it appends data to
filename in directory on /home/UUN/server_data/shapes/
*/
function save_data(directory, filename, data) {
  var url = "save_data.php";
  var data_to_send = {
    directory: directory,
    filename: filename,
    filedata: data,
  };
  fetch(url, {
    method: "POST",
    body: JSON.stringify(data_to_send),
    headers: new Headers({
      "Content-Type": "application/json",
    }),
  });
}


function save_al_data(data) {
  // choose the data we want to save - this will also determine the order of the columns
  var data_to_save = [
    PARTICIPANT_ID,
    data.exp_trial_type,
    data.block_n,
    data.trial_n,
    data.trial_index,
    data.time_elapsed,
    data.partner_id,
    data.object,
    data.label,
    data.object_choices, //on comprehension trials, options saved as a single underscore-separated string
    data.object_selected,
    data.score,
    data.rt,
  ];
  // join these with commas and add a newline
  var line = data_to_save.join(",") + "\n";
  //Write headers if this is the first write.
  if (!HEADERS_WRITTEN) {
    HEADERS_WRITTEN = true;
    var headers =
      "participant_id,exp_trial_type,block_n,\
      trial_n,trial_index,time_elapsed,partner_id,object,label,\
      object_choices,object_selected,score,rt\n";
    line = headers + line;
  }
  filename = "s_" + PARTICIPANT_ID + ".csv";
  save_data("participant_data", filename, line);
}


//just writing as one string with header attached
function save_demographics_data(demograpics_data) {
  //build filename using the participant_id, chain and generation global variables
  var filename = "demographics_s_" + PARTICIPANT_ID + ".csv";
  var headers =
    "participant_id,took_notes,comments,exit_mode\n";
  var data_to_save = [
    PARTICIPANT_ID,
    demograpics_data.notes,
    demograpics_data.comments,
    demograpics_data.exit_mode,
  ];
  var data_line = data_to_save.join(",") + "\n";
  save_data("participant_demographics", filename, headers + data_line);
}

/******************************************************************************/
/*** Managing progression counters ***********************************/
/******************************************************************************/

/*
Resets all counters. Pass in upcoming block to track maxmimum trial number. 
*/
function reset_progress_counters(upcoming_block) {
  var trial = {
    type: "call-function",
    func: function () {
      PROGRESSION_COUNTER.current_trial = 1;
      PROGRESSION_COUNTER.max_trial = upcoming_block.length;
      PROGRESSION_COUNTER.correct = 0;
    },
  };
  return trial;
}


/******************************************************************************/
/******************************************************************************/
/*** Colour test ******************************************************************/
/******************************************************************************/
/******************************************************************************/


var colour_test_errors = 0;

var colour_test_instructions = {
  type: "html-button-response",
  stimulus:
    "<h3>Pre-experiment check of colour display</h3>\
    <p style='text-align:left'>\
    First we'll do a quick check to make sure you can see the colours \
    we are using in the main experiment. On each check trial you will see a series of coloured circles, \
    each of which features a number from 1 to 100. For example, the circle below contains 74.</p>\
    <img src=images/colourtest/GreenTest.png> \
    <p style='text-align:left'>\
    On each trial, enter the number you see in the box provided - so in this case you would enter 74. \
    There is no back button, so you only have one attempt at each circle.</p>\
    <p style='text-align:left'>\
    This is not a full screening for colour vision and is not being used as a diagnostic tool, which \
    means that you will not be provided with results. If you have any concerns about your vision or \
    eye health, we encourage you to seek advice from your GP and/or a qualified optician.</p>",
  choices: ["Continue"]
}

function make_colourtest(image,answer) {
  var colour_test_trial = {
    type: "survey-html-form",
    html: "<p><img src=images/colourtest/" + image + ".png></p>\
    <p><input name='number' type='number' /></p>",
    preamble: "<em>Enter the number you see, then click Continue</em>",
    on_finish: function(data) {
      //console.log(data.response.number)
      if (data.response.number != answer) {//answer in here!
        colour_test_errors++;
      }
    }
  }
  return colour_test_trial;
}


var colour_test_block = 
{timeline: [].concat(colour_test_instructions,
  jsPsych.randomization.shuffle([make_colourtest('GreyTest','12'),
                          make_colourtest('PinkTest','8'),
                          make_colourtest('RedTest','45'),
                          make_colourtest('YellowTest','7')]))};






/******************************************************************************/
/******************************************************************************/
/*** Interaction **************************************************************/
/******************************************************************************/
/******************************************************************************/

/******************************************************************************/
/*** The interaction loop *****************************************************/
/******************************************************************************/

/*
Launches our interaction_loop function, which connects the browser to a python server running
and listens for instructions. There is more detail below on what those
instructions are - the code for the interaction_loop function is also in
dyadic_interaction_utilities.js. 
*/
var start_interaction_loop = { type: "call-function", func: interaction_loop };

/******************************************************************************/
/*** Instructions from the server *********************************************/
/******************************************************************************/

/*

The functions we will be asked to execute are:

waiting_room() - a simple function which creates an html-keyboard-response trial
to inform the participant they are in the waiting room, waiting to be paired with
a partner.

waiting_for_partner() - creates an html-keyboard-response trial to inform the
participant that they are waiting for their partner (because the partner
is reading instructions, picking a label, etc).

For waiting-room and waiting-for-partner trials, we don't know how long the
participant has to wait. These trials therefore have no set duration and can't be
ended by the participant! This allows them to wait indefinitely. But we have to have 
a way of kicking a participant out of one of these never-ending wait trials so we can actually
allow them to progress through the experiment once their waiting time is over.
We do this via another function, end_waiting(), which is triggered whenever we have
a new trial to run - end_waiting() checks if the participant is currently in an
infinite-wait trial, and if so ends that trial, which allows the experiment
to progress. You will see end_waiting() dotted about in the code, that's what it's
for, and we run it whenever we think the participant might just have been in an
infinte-wait trial.

show_interaction_instructions() - creates an html-keyboard-response trial
to inform the participant that they have been paired and are ready to start interacting.

partner_dropout() - creates a message informing the participant that something has
gone wrong, then redirects them to the end of the experiment. For multi-player experiments you
always need a procedure for handling participant dropout, otherwise you will get
a lot of irrate emails!

end_experiment() - creates the final info screen, and then when the participant
completes this trial, ends the entire timeline.

director_trial(target_meaning,context_array,label_choices,...,partner_id) - 
this creates and runs a single director trial, where the director is presented with 
target_object to be distinguished in the context of context_array and selects a label 
from label_options to send to partner_id. This info is then relayed back to the server, 
which will construct a matcher trial (see below). NB ... in the arguments indicates some 
book-keeping stuff on trial counters etc.

matcher_trial(label,context_array,...,partner_id) - this creates and runs a single matcher
trial, where the matcher is presented with label and selects an object from context_array, 
their guess about the object partner_id was labelling. This choice is then relayed back
to the server, which figures out whether the communication was a success or
failure and generates some feedback for both participants. 

display_feedback(score) - creates a simple text screen informing the participant
whether the communication was succesful (score=1) or unsuccesful (score=0).

Some of these functions use send_to_server to send a message back to the server - these
messages are one of a limited number that the server knows how to interpret, and can
sometimes include information based on the participant's response, e.g. what label
or object they selected. send_to_server is defined in dyadic_interaction_utilities.js.

Each of these functions is detailed below.
*/

/******************************************************************************/
/*** Waiting room **********************************************************/
/******************************************************************************/

/*
Builds a trial which informs the participant they are in the waiting room, adds
that trial to the timeline (using jsPsych.addNodeToEndOfTimeline), and then
instructs the experiment to resume.

The trial itself has a nested timeline - max_wait_exceeded will only be reached if
the participant cannot be paired, will cause the experiment to end via end_experiment().

phase will either be Pairing or AfterTraining, depending on whether they are waiting 
to be paired or waiting for their partner to finish training.
*/

function waiting_room(phase) {
  if (phase == "Pairing") {
    var waiting_text =
      "<p style='text-align:left'>You are in the waiting room. \
    Maximum wait time is " +
      max_wait +
      " minutes.</p>";
    var max_wait_exceeded_text =
      "<p style='text-align:left'>We have been unable to pair you with a partner. \
    Click continue progress to the final screen and finish the experiment.</p>";
  } 
  var post_timer_text =
    "<p style='text-align:left'><b>Please monitor this tab</b> - the \
  experiment will resume as soon as you are paired, and your partner will be \
  waiting for you.</p>";
  var max_wait_ms = max_wait * 60 * 1000;
  //timer-related bits and pieces
  var counter;
  var count = 0;
  var minutes = 0;
  var seconds = 0;
  var waiting_room = {
    type: "html-keyboard-response",
    choices: jsPsych.NO_KEYS,
    trial_duration: max_wait_ms,
    stimulus: function () {
      clearInterval(counter);
      counter = setInterval(timer, 1000); //1000 will run it every 1 second
      function timer() {
        count = count + 1;
        minutes = Math.floor(count / 60);
        seconds = count % 60;
        document.getElementById("timer-mins").innerHTML = minutes;
        document.getElementById("timer-seconds").innerHTML = seconds;
      }
      var timer_text =
        "<p style='text-align:left'>You have been \
                        waiting for <span id='timer-mins'>" +
        minutes +
        "</span> minutes \
                        <span id='timer-seconds'>" +
        seconds +
        "</span> seconds</p>";
      return waiting_text + timer_text + post_timer_text;
    },
    on_finish: function (data) {
      clearInterval(counter);
      data.exp_trial_type = "exit_waiting_room_" + phase;
      data.stimulus = "";
      save_al_data(data);
    },
  };
  //this will only be reached if maximum waiting time is exceeded, otherwise this timelien will be killed
  var max_wait_exceeded = {
    type: "html-button-response",
    stimulus: max_wait_exceeded_text,
    choices: ["Continue"],
    on_finish: function () {
      send_to_server({ response_type: "AFTER_TRAINING_TIMEOUT" });
      jsPsych.pauseExperiment();
      end_experiment("after_training_timeout");
    },
  };
  var waiting_room_trial = { timeline: [waiting_room, max_wait_exceeded] };
  jsPsych.addNodeToEndOfTimeline(waiting_room_trial);
  jsPsych.resumeExperiment();
}

/******************************************************************************/
/*** Waiting for partner ******************************************************/
/******************************************************************************/

/*
A simple waiting message trial - note the same structure, we create the trial, add
it to the timeline, run the timeline, and then pause the experiment after the trial
has run.

NB we run end_waiting() here too, just in case the participant was already waiting
when the server told them to wait!
*/
function waiting_for_partner() {
  end_waiting(); //end any current waiting trial
  var waiting_trial = {
    type: "html-keyboard-response",
    stimulus: "Waiting for partner",
    choices: jsPsych.NO_KEYS,
    on_finish: function () {
      jsPsych.pauseExperiment();
    },
  };
  jsPsych.addNodeToEndOfTimeline(waiting_trial);
  jsPsych.resumeExperiment();
}

/******************************************************************************/
/*** Ending infinite wait trials **********************************************/
/******************************************************************************/

/*
This ends the current trial *if* it's an infinite-wait trial. We access the current
trial using jsPsych.currentTrial(). We identify waiting-for-partner trials by looking
at the trial.stimulus. We identify the infinite-loop director trials by trial.type and
trial.choices.

if the current trial is a regular waiting trial, we end it with jsPsych.finishTrial() -
the timeline will be paused by the on_finish function of the waiting trial

If the current trial is a waiting room trial or a director trial
(image-button-response with one choice, namely the mic button), interrupt is more
complex - need to pause the timeline, finish the trial *and* its timeline
*/
function end_waiting() {
  var current_trial = jsPsych.currentTrial();
  //catch case where timeline has already ended
  if (typeof current_trial !== "undefined") {
    //this is the call-function trial to send the director's response to the server, we can just end it
    if (current_trial.type=="call-function") {
      jsPsych.finishTrial();
      //jsPsych.endCurrentTimeline();//this kills the rest of the production loop timeline?
    }
    else if (current_trial.stimulus == "Waiting for partner") {
      //waiting trial
      //NB the waiting-for-partner trial will pause the timeline in its on_finish
      jsPsych.finishTrial();
    } else if (current_trial.stimulus.includes("You are in the waiting room")) {
      //waiting room
      jsPsych.pauseExperiment();
      jsPsych.finishTrial();
      jsPsych.endCurrentTimeline();//this kills the rest of the waiting room timeline
    } else if (
      //KENNY check if we need this - I don't think we do, but it does little harm
      current_trial.type == "image-button-response" && //director trial
      current_trial.choices.length == 1
    ) {
      jsPsych.pauseExperiment();
      jsPsych.finishTrial();
      jsPsych.endCurrentTimeline();
    }
  }
}

/******************************************************************************/
/*** Instructions after being paired ******************************************/
/******************************************************************************/

/*
Participants receiving this command will be stuck on the never-ending waiting
room trial, so need to break them out of that trial with end_waiting(), then give
them their instructions.

Once the participant has read the instructions we use send_to_server to let the
server know we are done, by sending a specifically-formatted message which the server
knows how to interpret, then pause and wait for more instructions.
*/
function show_interaction_instructions() {
  end_waiting();
  var instruction_screen_interaction = {
    type: "html-button-response",
    stimulus:
      "<h3>Time to communicate with your partner!</h3>\
      <p style='text-align:left'>This game works in the same way as the warmup you played with the \
      computer, but now the pictures you are describing are a bit different, and so are the symbols \
      you can send - you are not sending words, but shapes! The game will start off easy but it will get harder!</p>\
      <p style='text-align:left'>But everything else works in the same way. When you are the SENDER you'll see several pictures on your screen, one of which will be highlighted \
      with a green box. Your job is to select a label (a geometrical shape) from a small set of options to name it for the receiver, \
      so that they can select the correct picture from their array.</p> \
      <img src=images/instructions/sender_instructions.png width=500px>\
      <p style='text-align:left'>\
      When you are the RECEIVER you'll wait for the sender to select a label, then you'll see \
      the label selected by the sender plus an array of several pictures on the screen - \
      the same set of pictures the sender saw, but they might be in a different order and you \
      don't get to see which object was highlighted for the sender! You just have to click on the \
      object that you think is being named by the sender. You'll both get a point for every correct \
      response.</p>\
      <img src=images/instructions/receiver_instructions.png width=500px>\
      <p style='text-align:left'><b>Remember</b>, your partner is waiting for you, so do respond promptly! In the unlikely event that \
      your partner becomes unresponsive then please return the experiment and message us on Prolific, we will make sure you are paid \
      for your time.</p>\
      <p style='text-align:left'><b>Remember</b>, we ask you not to take written notes during the experiment - we \
      are interested in what your brain can do, not what your brain plus a notebook can do, so just do your best.</p>",
    choices: ["Continue"],
    on_finish: function () {
      send_to_server({ response_type: "INTERACTION_INSTRUCTIONS_COMPLETE" });
      jsPsych.pauseExperiment();
    },
  };
  jsPsych.addNodeToEndOfTimeline(instruction_screen_interaction);
  jsPsych.resumeExperiment();
}


/******************************************************************************/
/*** Instructions when partner drops out **************************************/
/******************************************************************************/

/*
Emergency stop! Uses endExperiment to end the current timeline, then starts a new 
jspsych timeline with the exit procedure.
*/
function partner_dropout() {
  //need to emergency-halt everything
  jsPsych.endExperiment();
  var stranded_screen = {
    on_start: function() {end_experiment()},
    type: "html-button-response",
    stimulus:
      "<h3>Oh no, something has gone wrong!</h3>\
      <p style='text-align:left'>Unfortunately it looks like something has gone wrong - sorry!</p>\
      <p style='text-align:left'>Click below to finish the experiment.</p>",
    choices: ["Continue"],
  };
  jsPsych.init({
    timeline: [stranded_screen]
  });

  end_experiment("partner_dropout");
}

/******************************************************************************/
/*** End-of-experiment screens *************************************************/
/******************************************************************************/

/*
In this sequence of trials we close the connection
to the python server using close_socket(), then eventually end the entire timeline, using
jsPsych.endCurrentTimeline(), just in case there are any other lurking trials
that haven't been run yet (which can happen e.g. if the participant's partner drops
out mid-turn).
*/
function end_experiment(exit_mode) {
  close_socket();
  jsPsych.addNodeToEndOfTimeline(demographics(exit_mode));
  jsPsych.addNodeToEndOfTimeline(final_screen(exit_mode));
  jsPsych.resumeExperiment();
}

/*
This could collect more general demographics info, but at present it's just a comments box.
*/
function demographics(exit_mode) {
  if (exit_mode == "clean") {
    var exit_message =
      "<h3> That's it, you're all done!</h3> \
      <p style='text-align:left'>Congratulations on making it all the way to the end.</p> \
      <p style='text-align:left'>Did you write stuff down or take notes during the task? \
      Please be honest - it won't affect your payment, we promise, and if you tell us now \
      we can correct for this in our analysis without affecting the validity of our experiment.\
      <br><br>\
				<input type='radio' name='notes' id='notesN' value='no' required/>No I did not make notes<br>\
				<input type='radio' name='notes' id='notesY' value='yes' required/>OK I confess, I did make notes!</p>\
      <p style='text-align:left'>Please provide any comments you have on the experiment, \
      or anything else you want us to know. We'd be particularly interested to know how you figured out which labels to \
      use to communicate with your partner about the different shapes, colours, objects and emotions. If you took notes, \
      you could tell us briefly here what sort of stuff you wrote down.<br><br>\
      <textarea name='comments' rows='10' cols='120'></textarea></p>";
  } else {
    var exit_message =
      "<h3> That's it, you're all done!</h3> \
      <p style='text-align:left'>Did you write stuff down or take notes during the task? \
      Please be honest - it won't affect your payment, we promise, and if you tell us now \
      we can correct for this in our analysis without affecting the validity of our experiment.\
      <br><br>\
				<input type='radio' name='notes' id='notesN' value='no' required/>No I did not make notes<br>\
				<input type='radio' name='notes' id='notesY' value='yes' required/>OK I confess, I did make notes!</p>\
      <p style='text-align:left'>Please provide any comments you have on the experiment, \
      or anything else you want us to know. If you took notes, you could tell us briefly\
      here what sort of stuff you wrote down.<br><br>\
      <textarea name='comments' rows='10' cols='120'></textarea></p>";
  }
  var demographics_trial = {
    type: "survey-html-form",
    preamble: "<h3></h3>",
    button_label: "Continue",
    html: exit_message,
    on_finish: function (data) {
      //need to remove commas from responses to avoid messing with CSV data
      var comments = data.response.comments.replace(/,/g, "");
      var demo_data = {notes:data.response.notes, comments: comments, exit_mode: exit_mode };
      save_demographics_data(demo_data);
    },
  };
  return demographics_trial;
}

/* 
Redirection to prolific or instructions to return and request a bonus
*/
function final_screen(exit_mode) {
  if (exit_mode == "clean") {
    var final_trial = {
      type: "html-button-response",
      stimulus:
        "<h3>Finished!</h3>\
        <p style='text-align:left'>Press continue to complete the experiment and \
        submit your completion code to Prolific. Thanks for participating!</p>",
      choices: ["Submit completion code"],
      on_finish: function () {
        window.location =
          "https://app.prolific.co/submissions/complete?cc=" +
          PROLIFIC_COMPLETION_CODE;
      },
    };
  } else {
    var final_trial = {
      type: "html-button-response",
      stimulus:
        "<h3>Finished!</h3>\
        <p style='text-align:left'>Because something went wrong and you weren't able to complete the experiment, we have to pay you by bonus rather than completion code - don't worry, \
        you'll be paid the appropriate amount depending on how far you got through the experiment.</p>\
        <p style='text-align:left'>To get paid: please <b>send us a short message via the Prolific website</b> to let us know you need to be paid by bonus, \
        then <b>return the experiment</b> - this is the method Prolific have asked us to use for partial payment.</p>\
        <p style='text-align:left'>If for any reason you aren't able to message us via Prolific, please email Josie (josephine.bowerman@ed.ac.uk)\
          with your Prolific ID and we will make sure you get paid for your time.</p>\
          <p style='text-align:left'>Thanks for participating!</p>",
      choices: [],
    };
  }

  return final_trial;
}

/******************************************************************************/
/*** Director (label selection) trials ****************************************/
/******************************************************************************/

function director_trial(
  target_object,
  context_array,
  label_choices,
  interaction_block_n,
  trial_n,
  max_trial_n,
  partner_id
) {
  end_waiting();
  
  var buttons = label_choices


  var role_trial = {
    type: "html-keyboard-response",
    stimulus: function() {
      return "<p>You are SENDER</p>"
    },
    choices: jsPsych.NO_KEYS,
    trial_duration: 1000,
  };

  //define what a single production trial looks like - this will loop
  var single_production_trial = {
    //type: "image-button-response-promptabovebuttons",
    type: "html-button-response-twoprompts",
    stimulus: function() {
      var stimulus_string = ""
      for (context_item of context_array) {
        var style_string = "style='border:10px solid white;'"
        if (context_item==target_object) { //target gets a green box
          style_string = "style='border:10px solid green;'"
        }

        stimulus_string = stimulus_string + "<img src=images/" + context_item + ".png width=200px " + style_string + " >"
      
      }
      return stimulus_string
    },
    stimulus_height: 150,
    choices: buttons,
    button_html:
    '<button class="jspsych-btn"> <img src="images/%choice%.png" width=100px></button>',
    //show the building label in the prompt
    prompt1: function () {
        return "<p><em>Select a message to send to your partner (" + trial_n + "/" + max_trial_n + ")</em></p>";
      },
    
    //after the participant clicks, what happens depends on what they clicked
    on_finish: function (data) {
      //figure out what button they clicked using buttons and data.response
      var button_pressed = buttons[data.response];
      var final_label = button_pressed
      data.label = final_label;
      data.block_n = interaction_block_n;
      data.trial_n = trial_n;
      data.partner_id = partner_id; //add this to data so it is saved to data file
      data.object = target_object;
      data.label = final_label;
      data.exp_trial_type = "director"; //mark it as production data
      save_al_data(data); //save the data (which will include the built label)
      var message = {response_type: "RESPONSE",
                      participant: PARTICIPANT_ID,
                      partner: partner_id,
                      role: "Director",
                      target_object:target_object,
                      response: [final_label]} //this is a list for compatability with looping version
      send_to_server(message)
      jsPsych.pauseExperiment();
  
    }
  }

  //want to add role_trial seperately and in a flat structure, so the loop doesn't include that
  jsPsych.addNodeToEndOfTimeline(role_trial);
  jsPsych.addNodeToEndOfTimeline(single_production_trial);
  jsPsych.resumeExperiment();
}

/*
Not using this looping one
*/

function director_trial_looping(
  target_object,
  context_array,
  label_choices,
  interaction_block_n,
  trial_n,
  max_trial_n,
  partner_id
) {
  end_waiting();

  //add DELETE and SEND buttons
  var buttons = label_choices.concat(["DELETE","SEND"])

  var building_label = []; //store the components of the building label here
  var continue_production_loop = true; //use this to control the production loop

  var role_trial = {
    type: "html-keyboard-response",
    stimulus: function() {
      return "<p>You are SENDER</p>"
    },
    choices: jsPsych.NO_KEYS,
    trial_duration: 1000,
  };

  //define what a single production trial looks like - this will loop
  var single_production_trial = {
    //type: "image-button-response-promptabovebuttons",
    type: "html-button-response-twoprompts",
    stimulus: function() {
      var stimulus_string = ""
      for (context_item of context_array) {
        var style_string = "style='border:10px solid white;'"
        if (context_item==target_object) { //target gets a green box
          style_string = "style='border:10px solid green;'"
        }

        stimulus_string = stimulus_string + "<img src=images/" + context_item + ".png width=200px " + style_string + " >"
      
      }
      return stimulus_string
    },
    stimulus_height: 150,
    choices: buttons,
    button_html:
    '<button class="jspsych-btn"> <img src="images/%choice%.png" width=100px></button>',
    //show the building label in the prompt
    prompt1: function () {
        return "<p><em>Build a message and send to your partner (" + trial_n + "/" + max_trial_n + ")</em></p>";
      },
    prompt2: function () {
      //if bulding label = [], dummy prompt
      if (building_label.length==0) {
        return "<img src=images/blank.png width=150px>"
      }
      //otherwise, paste together images in building_label into a single stinng
      else {
        var prompt2_string = ""
      for (signal_item of building_label) {
        prompt2_string = prompt2_string + "<img src=images/" + signal_item + ".png width=75px >"
      
      }

        return prompt2_string;
      }
    },
    //after the participant clicks, what happens depends on what they clicked
    on_finish: function (data) {
      //figure out what button they clicked using buttons and data.response
      var button_pressed = buttons[data.response];
      //if they clicked DONE
      if (button_pressed == "SEND") {
        //only end the loop if they have produced *something*
        if (building_label.length > 0) {
          var final_label = building_label.join("-");
          data.label = final_label;
          data.block_n = interaction_block_n;
          data.trial_n = trial_n;
          data.partner_id = partner_id; //add this to data so it is saved to data file
          data.object = target_object;
          data.label = final_label;
          data.exp_trial_type = "director"; //mark it as production data
          save_al_data(data); //save the data (which will include the built label)
          continue_production_loop = false; //break out of the loop
          var message = {response_type: "RESPONSE",
                          participant: PARTICIPANT_ID,
                          partner: partner_id,
                          role: "Director",
                          target_object:target_object,
                          response: building_label}
          send_to_server(message)
          jsPsych.pauseExperiment();
      
        }
      }
      //if they clicked DELETE, just delete the last syllable from building_label
      //which can be done using slice
      else if (button_pressed == "DELETE") {
        building_label = building_label.slice(0, -1);
      }
      //otherwise they must have clicked a syllable button, so just add that
      //to the building label
      else {
        building_label.push(button_pressed);
      }
    },
  };
  //slot single_production_trial into a loop
  var production_loop = {
    timeline: [single_production_trial],
    loop_function: function () {
      return continue_production_loop; //keep looping until continue_production_loop=false
    },
  };

    

  //want to add role_trial seperately and in a flat structure, so the loop doesn't include that
  jsPsych.addNodeToEndOfTimeline(role_trial);
  jsPsych.addNodeToEndOfTimeline(production_loop);
  jsPsych.resumeExperiment();
}

/******************************************************************************/
/*** Matcher (object selection) trials ****************************************/
/******************************************************************************/

/*

*/
function matcher_trial(
  director_label,
  target_object,
  context_array,
  interaction_block_n,
  trial_n,
  max_trial_n,
  partner_id
) {
  end_waiting();

  var trial = {
    type: "html-button-response-twoprompts",
    stimulus: function() {
      var stimulus_string = "<p>Message from partner:</p>"
      for (signal_item of director_label) {
        stimulus_string = stimulus_string + "<img src=images/" + signal_item + ".png width=150px >"
      }
      return stimulus_string;
    },

    choices: context_array,
    button_html:
      '<button class="jspsych-btn"> <img src="images/%choice%.png" width=200px></button>',
    prompt1: function () {
      return (
        "<p><em>Click on the one your partner is naming (" +
        trial_n +
        "/" +
        max_trial_n +
        ")</em></p>"
      );
    },
    on_finish: function (data) {
      var button_number = data.response;

      data.exp_trial_type = "matcher";
      data.block_n = interaction_block_n;
      data.trial_n = trial_n;
      data.partner_id = partner_id; //add this to data so it is saved to data file
      data.object = target_object;
      data.label = director_label.join("-");
      data.object_choices = context_array.join("_");
      data.object_selected = context_array[button_number];
      if (data.object_selected == target_object) {
        data.score = 1;
      } else {
        data.score = 0;
      }
      save_al_data(data);
      send_to_server({
        response_type: "RESPONSE",
        participant: PARTICIPANT_ID,
        partner: partner_id,
        role: "Matcher",
        response: data.object_selected,
      });
      jsPsych.pauseExperiment();
    },
  };
  //jsPsych.addNodeToEndOfTimeline(role_trial);
  jsPsych.addNodeToEndOfTimeline(trial);
  jsPsych.resumeExperiment();
}

/******************************************************************************/
/*** Feedback trials **********************************************************/
/******************************************************************************/

/*
Feedback which displays the director's target, the matcher's choice, and the 
success/failure of the trial.
*/
function display_feedback(director_object, matcher_object, score, break_allowed) {
  //console.log(break_allowed)
  end_waiting();
  if (score == 1) {
    var feedback_text = "<p style='color:green'>Correct!</p>";
    var audio_stim = "sounds/_feedback/_correct.mp3";
  } else {
    var feedback_text = "<p style='color:red'>Incorrect!</p>";
    var audio_stim = "sounds/_feedback/_incorrect.mp3";
  }
  var feedback_stim =
    feedback_text +
    "<p>Sender saw:<img src='images/" +
    director_object +
    ".png' width=100px style='vertical-align:middle'></p>\
    <p>Receiver selected:<img src='images/" +
    matcher_object +
    ".png' width=100px style='vertical-align:middle'></p>";
  //if break_allowed is true we need to give them a self-paced break, which involves 
  //handling the messaging of the server slightly differently - message sent back to the server
  //after the feedback trial if they are on a break, otherwise after the break
  if (break_allowed=='true') {
    var feedback_trial = {
      type: "audio-keyboard-response",
      stimulus: audio_stim,
      prompt: feedback_stim,
      choices: jsPsych.NO_KEYS,
      trial_duration: 2500
    };
    var break_trial = {
      type: "html-button-response",
      stimulus: "You now have the option to take a short pause. \
      Remember, your partner may be waiting for you!",
      choices: ['Continue'],
    };
    var waiting_trial = {
      type: "html-keyboard-response",
      stimulus: "Waiting for partner",
      choices: jsPsych.NO_KEYS,
      on_start: function () {
        send_to_server({ response_type: "FINISHED_FEEDBACK" });
      },
      on_finish: function () {
        jsPsych.pauseExperiment();
      },
    };
    jsPsych.addNodeToEndOfTimeline(feedback_trial);
    jsPsych.addNodeToEndOfTimeline(break_trial);
    jsPsych.addNodeToEndOfTimeline(waiting_trial);
  }
  else {
    var feedback_trial = {
      type: "audio-keyboard-response",
      stimulus: audio_stim,
      prompt: feedback_stim,
      choices: jsPsych.NO_KEYS,
      trial_duration: 2500,
      on_finish: function () {
        send_to_server({ response_type: "FINISHED_FEEDBACK" });
        jsPsych.pauseExperiment();
      },
    };
    jsPsych.addNodeToEndOfTimeline(feedback_trial);
  }
  jsPsych.resumeExperiment();
}

/******************************************************************************/
/******************************************************************************/
/*** Other instruction screens ******************************************************/
/******************************************************************************/
/******************************************************************************/

var consent_screen = {
  type: "html-button-response",
  stimulus:
    "<h3>Welcome to the experiment</h3> \
  <p style='text-align:left'>Thank you for choosing to take part in our study!\
  The full experiment takes 35-45 minutes to complete and you will be paid &pound;7.</p>\
  \
  <p style='text-align:left'>This experiment is part of a research project conducted by Prof. Kenny \
  Smith and Dr. Josephine Bowerman at The University of Edinburgh, and has been approved by the Linguistics and \
  English Language Ethics Committee. Please click here to download a study information letter \
  <a href='shapes_participant_information.pdf' download>(pdf)</a> \
  that provides further information about the study.</p>\
  \
  <p style='text-align:left'>Clicking on the consent button below indicates that:<br>\
    - You have downloaded and read the information letter<br>\
    - You voluntarily agree to participate<br>\
    - You are at least 18 years of age<br>\
    - You are a native speaker of English<br>\
    If you do not agree to all of these, please do not participate in this experiment.</p>\
  \
  <p style='text-align:left'><b>This experiment requires you to interact in real time with another \
  participant, sending each other simple visual labels through your web browser. </b> Since your \
  partner will be waiting for you throughout the experiment, and depends on your prompt responses to \
  complete the experiment in a timely fashion, please do not participate if you aren't able to give the \
  experiment and your partner your full attention.</p>\
  \
  <p style='text-align:left'><b>Please do not take written notes!</b> In this experiment we \
  are interested in what your brain can do, not what your brain plus a notebook \
  can do, so please don\'t write anything down. Just do your best - \
  we are interested in places where communication breaks down as well as where it succeeds, and we don't expect perfection!</p>\
  \
  <p style='text-align:left'><b>This experiment requires you to view and respond to colour images</b>. \
  We will do a quick check at the start to ensure you can see the colours involved well enough for our \
  purposes, but if your equipment is not able to show colours please don't participate. </p>",
  choices: ["Yes, I consent to participate"],
};

var initial_instructions = {
  type: "html-button-response",
  stimulus:
    "<h3>Introduction to the experiment</h3>\
  <p style='text-align:left'>\
  In this experiment you will play a communication game with another experiment participant \
  (another person on Prolific). The objective of the game is to use symbols to express a target \
  meaning to your partner, and to work out the meaning of your partner’s messages.</p>\
  <p style='text-align:left'>\
  We'll talk you through how to send and respond to messages shortly. If you don't want to do \
  an experiment that involves interacting with another participant, you can return the experiment now!</p>",
  choices: ["Continue"],
};

var preload_instructions = {
  type: "html-button-response",
  stimulus:
    "<h3>Loading experient images</h3>\
  <p style='text-align:left'>\
  Click continue to load the experiment images - depending on the speed of your connection, \
  this may take up to a minute.</p>",
  choices: ["Continue"],
};

var preload = {
  type: "preload",
  images:
  [
    "images/angry.png",
    "images/banana.png",
    "images/beach.png",
    "images/blank.png",
    "images/circle.png",
    "images/circle_blue.png",
    "images/circle_green.png",
    "images/circle_grey.png",
    "images/circle_pink.png",
    "images/circle_red.png",
    "images/circle_white.png",
    "images/circle_yellow.png",
    "images/city.png",
    "images/desert.png",
    "images/diamond.png",
    "images/diamond_blue.png",
    "images/diamond_green.png",
    "images/diamond_grey.png",
    "images/diamond_pink.png",
    "images/diamond_red.png",
    "images/diamond_white.png",
    "images/diamond_yellow.png",
    "images/excited.png",
    "images/happy.png",
    "images/inlove.png",
    "images/pig.png",
    "images/river.png",
    "images/sad.png",
    "images/splat_blue.png",
    "images/splat_green.png",
    "images/splat_grey.png",
    "images/splat_pink.png",
    "images/splat_red.png",
    "images/splat_yellow.png",
    "images/square.png",
    "images/square_blue.png",
    "images/square_green.png",
    "images/square_grey.png",
    "images/square_pink.png",
    "images/square_red.png",
    "images/square_white.png",
    "images/square_yellow.png",
    "images/star.png",
    "images/star_blue.png",
    "images/star_green.png",
    "images/star_grey.png",
    "images/star_pink.png",
    "images/star_red.png",
    "images/star_white.png",
    "images/star_yellow.png",
    "images/cross.png",
    "images/cross_blue.png",
    "images/cross_green.png",
    "images/cross_grey.png",
    "images/cross_pink.png",
    "images/cross_red.png",
    "images/cross_white.png",
    "images/cross_yellow.png",
    "images/pentagon.png",
    "images/pentagon_blue.png",
    "images/pentagon_green.png",
    "images/pentagon_grey.png",
    "images/pentagon_pink.png",
    "images/pentagon_red.png",
    "images/pentagon_white.png",
    "images/pentagon_yellow.png",
    "images/hexagon.png",
    "images/hexagon_blue.png",
    "images/hexagon_green.png",
    "images/hexagon_grey.png",
    "images/hexagon_pink.png",
    "images/hexagon_red.png",
    "images/hexagon_white.png",
    "images/hexagon_yellow.png",
    "images/tulips.png",
    "images/volcano.png",
    "images/warmup_a_cat.png",
    "images/warmup_a_cow.png",
    "images/warmup_a_dog.png",
    "images/warmup_a_lion.png",
    "images/warmup_a_rabbit.png",
    "images/warmup_a_sheep.png",
    "images/warmup_o_ball.png",
    "images/warmup_o_book.png",
    "images/warmup_o_cake.png",
    "images/warmup_o_car.png",
    "images/warmup_o_cup.png",
    "images/warmup_o_pencil.png",
    "images/warmup_v_dance.png",
    "images/warmup_v_eat.png",
    "images/warmup_v_run.png",
    "images/warmup_v_sing.png",
    "images/warmup_v_sleep.png",
    "images/warmup_v_swim.png",
    "images/colourtest/GreenTest.png",
    "images/colourtest/GreyTest.png",
    "images/colourtest/PinkTest.png",
    "images/colourtest/RedTest.png",
    "images/colourtest/YellowTest.png",
    "images/instructions/warmup_sender_instructions.png",
    "images/instructions/warmup_receiver_instructions.png",
    "images/instructions/sender_instructions.png",
    "images/instructions/receiver_instructions.png",
  ]

}


var enter_waiting_room_instructions = {
  type: "html-button-response",
  stimulus:
    "<h3>You are about to enter the waiting room for pairing!</h3>\
  <p style='text-align:left'>Once you proceed past this point we will attempt to pair you with another participant on Prolific. \
  As soon as you are paired you will start to play the communication game together. <b> Once you are paired, your partner will be waiting for you \
  and depends on you to finish the experiment</b>, so please progress through the experiment in a timely fashion, \
  and please if at all possible <b>don't abandon or reload the experiment</b> since this will also end the experiment for your partner.</p>\
  <p style='text-align:left'>If we can't pair you within 5 minutes, or if something goes wrong, we'll ask you to return \
  the experiment and message us, then we'll pay you a reduced amount via a one-off bonus to cover the time you spent on the experiment \
  - this is how Prolific have asked us to handle partial payment, we'll explain this again in the event that you don't get paired. \
  But don't worry, nearly everyone gets paired, and absolutely everyone gets paid for their time!</p>",
  choices: ["Continue"],
  on_finish: function (data) {
    data.exp_trial_type = "enter_waiting_room";
    data.stimulus = "";
    save_al_data(data);
  }
};

/******************************************************************************/
/*** Pre-check conditionals *******************************************************/
/******************************************************************************/

var colour_exit_screen = {
  type: "html-button-response",
  stimulus:
    "<p style='text-align:left'>Sorry, but it looks like your monitor isn't able to display\
    the colours we use in this experiment. Please return the experiment. If you think you \
    are seeing this message in error please message us on Prolific.</p>",
  choices: [],
};

//only runs timeline if they *failed* the warmup
var failed_colour_conditional = {
  timeline: [colour_exit_screen],
  conditional_function: function(){
      if (colour_test_errors>max_colour_errors){
          return true;
      } else {
          return false;
      }
  }
}

var forced_exit_screen = {
  type: "html-button-response",
  stimulus:
    "<p style='text-align:left'>Sorry, but you have failed the attention checks in the warmup trials.\
     Please return the experiment. If you think you are seeing this message \
    in error please message us on Prolific.</p>",
  choices: [],
};

//only runs timeline if they *failed* the warmup
var failed_warmup_conditional = {
  timeline: [forced_exit_screen],
  conditional_function: function(){
      if (warm_up_errors>max_warmup_errors){
          return true;
      } else {
          return false;
      }
  }
}

/******************************************************************************/
/*** Run the timeline *******************************************************/
/******************************************************************************/


async function check_duplicates_and_run() {
  //we need to send the id to the PHP script to check for duplicates
  var data_to_send = { participant_id: PARTICIPANT_ID }; 
  var response = await fetch("check_duplicates.php", {
    method: "POST",
    body: JSON.stringify(data_to_send),
    headers: new Headers({
      "Content-Type": "application/json",
    }),
  });
  var duplicate_response = await response.text();
  console.log(duplicate_response);
  if (duplicate_response == "NotDuplicate") {
    var full_timeline = [].concat(
      consent_screen,
      initial_instructions,
      preload_instructions,preload,
      colour_test_block,  //KENNY! Comment here to speed up testing
      failed_colour_conditional,
      warmup_block,
      failed_warmup_conditional,//if they failed the warmup will display a kickout message and they'll get stuck
      enter_waiting_room_instructions,
      start_interaction_loop
    );
    //console.log(full_timeline)
    jsPsych.init({
      timeline: full_timeline,
    });
  } else {
    var duplicate_participant_trial = {
      type: "html-button-response",
      stimulus:
        "<p style='text-align:left'>Sorry, but our records show that you have already completed this experiment \
      (or one closely related to it). Please help us out and return the experiment. If you think you are seeing this message \
      in error (e.g. because you re-loaded the experiment) please message us on Prolific or email Kenny (kenny.smith@ed.ac.uk).</p>",
      choices: [],
    };
    jsPsych.init({
      timeline: [duplicate_participant_trial],
    });
  }
}

/*
Run the timeline
*/

check_duplicates_and_run();
