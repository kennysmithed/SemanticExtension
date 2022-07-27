/******************************************************************************/
/******************************************************************************/
/*** Warm-up ******************************************************************/
/******************************************************************************/
/******************************************************************************/


/*
Prior to entering the waiting room participants do warm-up trials to familiarise 
them with the task (and also to enable us to weed out random clickers). These are
very similar to the real interaction trials in layout, but sufficiently different
in procedure that they need their own code.
*/

/******************************************************************************/
/*** Warm-up director (label selection) trials ****************************************/
/******************************************************************************/

var warm_up_errors = 0; //keep track of n errors
function warmup_director_trial(
  target_object,
  context_array,
  label_choices,
  incorrect_matcher_selection,
  underspecified_matcher_selection,
  correct_label_choice,
  incorrect_label_choice,
  underspecified_label_choice
) {
  var score;
  var response_type; //will track whether they did the right thing here or not
  var buttons = label_choices

  var role_trial = {
    type: "html-keyboard-response",
    stimulus: function() {
      return "<p>You are SENDER</p>"
    },
    choices: jsPsych.NO_KEYS,
    trial_duration: 2000,
  };

  //define what a single production trial looks like 
  var single_production_trial = {
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
  
    //show the building label in the prompt
    prompt1: function () {
        return "<p><em>Select a message to send to your partner</em></p>";
      },
    
    //after the participant clicks, what happens depends on what they clicked
    on_finish: function (data) {
      //figure out what button they clicked using buttons and data.response
      var button_pressed = buttons[data.response];
      var final_label = button_pressed
      data.label = final_label;
      data.block_n = "warmup";
      data.trial_n = "warmup";
      data.partner_id = "warmup"; 
      data.object = target_object;
      data.label = final_label;
      data.exp_trial_type = "director"; //mark it as production data
      save_al_data(data); //save the data (which will include the built label
      if (final_label==correct_label_choice) {
        score=1;
        response_type = 'correct';
      }
      else if (final_label==incorrect_label_choice) {
        score=0;
        response_type = 'incorrect';
        warm_up_errors++;
      }
      else if (final_label==underspecified_label_choice) {
        score=0;
        response_type = 'underspecified';
        warm_up_errors++;
      }
    }
  }

  var waiting_trial = {
    type: "html-keyboard-response",
    stimulus: "Waiting for the computer to respond",
    choices: jsPsych.NO_KEYS,
    trial_duration: 2000
  };

  var feedback_trial = {
    type: "audio-keyboard-response",
    stimulus: function() {
      if (score == 1) {
        return "sounds/_feedback/_correct.mp3";
      }
      else {
        return "sounds/_feedback/_incorrect.mp3";
      }
    },
    prompt: function() {
      if (score == 1) {
        return "<p style='color:green'>Correct!</p>" + 
        "<p>Sender saw:<img src='images/" +
        target_object +
        ".png' width=100px style='vertical-align:middle'></p>\
        <p>Receiver selected:<img src='images/" +
        target_object +
        ".png' width=100px style='vertical-align:middle'></p>";
      }
      else if (response_type == "underspecified") {
        return "<p style='color:red'>Incorrect!</p>" + 
        "<p>Sender saw:<img src='images/" +
        target_object +
        ".png' width=100px style='vertical-align:middle'></p>\
        <p>Receiver selected:<img src='images/" +
        underspecified_matcher_selection +
        ".png' width=100px style='vertical-align:middle'></p>";
      }
      else if (response_type == "incorrect") {
        return "<p style='color:red'>Incorrect!</p>" + 
        "<p>Sender saw:<img src='images/" +
        target_object +
        ".png' width=100px style='vertical-align:middle'></p>\
        <p>Receiver selected:<img src='images/" +
        incorrect_matcher_selection +
        ".png' width=100px style='vertical-align:middle'></p>";
      }
    },
    choices: jsPsych.NO_KEYS,
    trial_duration: 4000,
  };

  //additional text feedback only required if participant gives the incorrect response
  var additional_feedback_trial = {
    type: "html-button-response",
    choices: ["I have read the advice, I am ready to continue"],
    stimulus: function() {
      if (response_type == "underspecified") {
        return "<h3>Please read this additional advice carefully, then click to continue.</h3>" +
                "<p style='text-align:left'>Your label choice wasn't sufficiently specific - the \
                receiver had several options you could have been describing, and wasn't sure which \
                one you meant. Try to be specific enough so that the receiver knows what to click on!</p>"
      }
      else {
        return "<h3>Please read this additional advice carefully, then click to continue.</h3>" +
                "<p style='text-align:left'>Your label choice was not correct - remember, your task is \
                to select a label to communicate the concept highlighted with the green box to your partner!</p>"
      }
    },
  };
  //additional text feedback only required if participant gives the incorrect response
  var feedback_if_node = {
    timeline: [additional_feedback_trial],
    conditional_function: function(){
        if (score==1){
            return false;
        } else {
            return true;
        }
    }
  }

  return {timeline: [role_trial,single_production_trial,waiting_trial,feedback_trial,feedback_if_node]}
}


/******************************************************************************/
/*** Warmup matcher (object selection) trials *********************************/
/******************************************************************************/

/*

*/
function warmup_matcher_trial(
  director_label,
  target_object,
  context_array,
) {
  var score; //keep track of score for feedback
  var selection;

  var waiting_trial = {
    type: "html-keyboard-response",
    stimulus: "Waiting for the computer to choose a label",
    choices: jsPsych.NO_KEYS,
    trial_duration: 2000
  };

  var matcher_trial = {
    type: "html-button-response-twoprompts",
    stimulus: function() {
      var stimulus_string = "<p>Message from partner:</p>" + director_label;
      return stimulus_string;
    },

    choices: context_array,
    button_html:
      '<button class="jspsych-btn"> <img src="images/%choice%.png" width=200px></button>',
    prompt1: function () {
      return (
        "<p><em>Click on the one your partner is naming</em></p>"
      );
    },
    on_finish: function (data) {
      var button_number = data.response;

      data.exp_trial_type = "matcher";
      data.block_n = "warmup";
      data.trial_n = "warmup";
      data.partner_id = "warmup";
      data.object = target_object;
      data.label = director_label;
      data.object_choices = context_array.join("_");
      data.object_selected = context_array[button_number];
      if (data.object_selected == target_object) {
        data.score = 1;
      } else {
        data.score = 0;
      }
      save_al_data(data);
      score = data.score;
      selection = data.object_selected;
    },
  };
  var feedback_trial = {
    type: "audio-keyboard-response",
    stimulus: function() {
      if (score == 1) {
        return "sounds/_feedback/_correct.mp3";
      }
      else {
        return "sounds/_feedback/_incorrect.mp3";
      }
    },
    prompt: function() {
      if (score == 1) {
        return "<p style='color:green'>Correct!</p>" + 
        "<p>Sender saw:<img src='images/" +
        target_object +
        ".png' width=100px style='vertical-align:middle'></p>\
        <p>Receiver selected:<img src='images/" +
        selection +
        ".png' width=100px style='vertical-align:middle'></p>";
      }
      else  {
        return "<p style='color:red'>Incorrect!</p>" + 
        "<p>Sender saw:<img src='images/" +
        target_object +
        ".png' width=100px style='vertical-align:middle'></p>\
        <p>Receiver selected:<img src='images/" +
        selection +
        ".png' width=100px style='vertical-align:middle'></p>";
      }
    },
    choices: jsPsych.NO_KEYS,
    trial_duration: 4000,
  };
  return {timeline:[waiting_trial,matcher_trial,feedback_trial]}
}

/******************************************************************************/
/*** Warmup instructions and full block ***************************************/
/******************************************************************************/


var initial_warmup_instructions = {
  type: "html-button-response",
  stimulus:
    "<h3>Pre-experiment warmup</h3>\
    <p style='text-align:left'>\
    Before we pair you with a partner we'll do a short warm-up, which will familiarise you with \
    the experiment interface and allow us to check you understand the task and are paying attention! \
    <b>You need to do well on this warm-up task to proceed to the main experiment!</b> \
    So please read these instructions carefully.</p>",
  choices: ["Continue to instructions"]
}

var sender_instructions = {
  type: "html-button-response",
  stimulus:
  "<h3>Pre-experiment warmup</h3>\
  <p style='text-align:left'>\
    In the warm-up you will practice sending and interpreting messages by playing a communication \
    game with the computer. You and the computer will take turns playing as SENDER and RECEIVER.</p> \
    <p style='text-align:left'>\
    When you are the SENDER you'll see several pictures on your screen, one of which will be highlighted \
    with a green box. Your job is to select a label from a small set of options to name it for the receiver, \
    so that they can select the correct picture from their array.</p> \
    <img src=images/instructions/warmup_sender_instructions.png width=500px>\
    <p style='text-align:left'>\
    After sending your message, you'll wait briefly for the computer to guess which picture you are \
    labelling. When the receiver has chosen, you’ll see which picture they selected on the basis of \
    your label.</p>",
  choices: ["Continue to receiver instruction"]
}

var receiver_instructions = {
  type: "html-button-response",
  stimulus:
  "<h3>Pre-experiment warmup</h3>\
  <p style='text-align:left'>\
    <p style='text-align:left'>\
    When you are the RECEIVER you'll wait for the sender to select a label, then you'll see \
    the label selected by the sender plus an array of several pictures on the screen - \
    the same set of pictures the sender saw, but they might be in a different order and you \
    don't get to see which object was highlighted for the sender! You just have to click on the \
    object that you think is being named by the sender. You'll both get a point for every correct \
    response.</p>\
    <img src=images/instructions/warmup_receiver_instructions.png width=500px>\
    <p style='text-align:left'>\
    Remember, you have to do well on the warm-up task to progress to the main experiment!",
  choices: ["Start the warm-up"]
}

var warmup_instructions = {
  timeline:[initial_warmup_instructions,sender_instructions,receiver_instructions]
}

var warmup_block = [
  warmup_instructions,
  warmup_director_trial(
    "warmup_o_pencil",
    jsPsych.randomization.shuffle(["warmup_o_pencil","warmup_o_cup","warmup_o_ball"]),
    jsPsych.randomization.shuffle(["pencil","ball","object"]),
    "warmup_o_ball", //incorrect matcher selection
    "warmup_o_cup", //underspecified matcher selection
    "pencil", //correct label choice
    "ball", //incorrect_label_choice,
    "object" //underspecified_label_choice
  ),
  warmup_matcher_trial(
    "book",//director_label,
    "warmup_o_book",//target_object,
    jsPsych.randomization.shuffle(["warmup_o_book","warmup_o_cake","warmup_o_car"])//context_array,
  ),
  warmup_director_trial(
    "warmup_a_lion",
    jsPsych.randomization.shuffle(["warmup_a_lion","warmup_a_dog","warmup_a_rabbit"]),
    jsPsych.randomization.shuffle(["lion","dog","animal"]),
    "warmup_a_dog", //incorrect matcher selection
    "warmup_a_rabbit", //underspecified matcher selection
    "lion", //correct label choice
    "dog", //incorrect_label_choice,
    "animal" //underspecified_label_choice
  ),
  warmup_matcher_trial(
    "sheep",//director_label,
    "warmup_a_sheep",//target_object,
    jsPsych.randomization.shuffle(["warmup_a_sheep","warmup_a_cat","warmup_a_cow"])//context_array,
  ),
  warmup_director_trial(
    "warmup_v_sing",
    jsPsych.randomization.shuffle(["warmup_v_sing","warmup_v_run","warmup_v_eat"]),
    jsPsych.randomization.shuffle(["sing","run","person"]),
    "warmup_v_run", //incorrect matcher selection
    "warmup_v_eat", //underspecified matcher selection
    "sing", //correct label choice
    "run", //incorrect_label_choice,
    "person" //underspecified_label_choice
  ),
  warmup_matcher_trial(
    "swim",//director_label,
    "warmup_v_swim",//target_object,
    jsPsych.randomization.shuffle(["warmup_v_swim","warmup_v_sleep","warmup_v_dance"])//context_array,
  ),
];