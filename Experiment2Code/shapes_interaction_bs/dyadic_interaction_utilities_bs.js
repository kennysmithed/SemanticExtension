//main difference from Experiment 1 code is that we need to pass across a participant-specific 
//mapping, which gives the mapping to participant-specific shapes

//create a global websocket variable that we can access everywhere
var ws_interaction;

/*
interaction_loop() handles the interaction with the server: clients sit here while waiting
for input from the server, and then take actions based on the instructions they
receive from the server.

The websocket code we are using for the server comes from
https://github.com/Pithikos/python-websocket-server, they have a simple example
client and server if you want to start from something simpler!

Sockets just send strings of characters back and forth - we use JSON.stringify
to encode javascript objects into a format that can be interpreted into python
dictionaries at the other end, and JSON.parse to convert the strings from the server
into javascript objects that we can work with here.

I am using a couple of conventions to simplify processing of the messages received
by the server and the client.

Every message the client sends the server is an object including a key
called response_type - the server looks at the response_type value to decide what
to do with that client response.

Every message the server sends the client is an object including a key called
command_type - the client looks at the command type to figure out what the server
is askng it to do.
*/

function interaction_loop() {
  //pause the timeline to stop us progressing past this point - incoming commands
  //from the server will unpause us
  jsPsych.pauseExperiment()
  ws_interaction = new WebSocket("wss://blake4.ppls.ed.ac.uk/" + main_port_number + "/");
  //when establishing connection for first time, send over some info - in this case,
  //the server needs to know PARTICIPANT_ID, which is a unique identifier for this
  //participant

  //send an intermittent Ping to the server
  var timerID = 0;
  var timeout = 5000
	function keepAlive() {
    console.log(ws_interaction.readyState)
	    if (ws_interaction.readyState == ws_interaction.OPEN) {
        //console.log("sending ping")
        ws_interaction.send(JSON.stringify({response_type:'Ping'}))
	    }
	    timerID = setTimeout(keepAlive, timeout);
	}
  
  function cancelKeepAlive() {
	    if (timerID) {
	        clearTimeout(timerID);
	    }
  }
  

  ws_interaction.onopen = function() {
    console.log("opening websocket");
    details = JSON.stringify({response_type:'CLIENT_INFO',client_info:PARTICIPANT_ID})
    console.log(details)
    ws_interaction.send(details) //send the encoded string to the server via the socket
    keepAlive() //start the ping-pong heartbeat with the server
  };

  //on receiving a message from the server...
  ws_interaction.onmessage = function(e) {
    // e.data contains received string.
    //console.log("received message: " + e.data); //display in the console (for debugging!)
    var cmd = JSON.parse(e.data) //parse into a js object
    var cmd_code =  cmd.command_type //consult the command_type key
    handle_server_command(cmd_code,cmd) //handle the command
  }

  //when the server tells you to close the connection, simply log this in the
  //console and close
  ws_interaction.onclose = function() {
    console.log("closing websocket");
    cancelKeepAlive()
    ws_interaction.close();
  };

  //when there is an error from the socket (e.g. because the server crashes or is
  //down), calls partner_dropout(), which is a function showing a screen telling the
  //participant that something has gone wrong, which allows them to exit the experiment
  //cleanly.
  ws_interaction.onerror = function(e) {
    console.log(e)
    partner_dropout()
  };
}

/*
handle_server_command calls the appropriate function depending on the command
the server sent - the different command types are given by command_code (which
was included in the info the server sent), some of the commands require additional
info so we also pass in the full command (a javascript dictionary)

command_code can be many different things:
    PairID: code to use in audio pairing with partner
    PartnerDropout: your partner has dropped out
    EndExperiment: quit, you have finished the experiment
    WaitingRoom: puts client in waiting room
    Instructions: Show instructions
    Director: Director trial
    WaitForPartner: Waiting screen
    Matcher: Matcher trial
    Feedback: Feedback (for both Director and Matcher)

For the Instructions, Director, Matcher and Feedback trial types, the client will
send a response back to the server, indicating the client has completed that trial
and (for Director and Matcher trials) providing information on the director or
matcher's response. This response will trigger actions by the server to move to
progress with the experiment.
*/

function handle_server_command(command_code,command) {
  //just for safety I like to check that the command code is one of the legal ones,
  //might give minimal protection against malicious connections
  var possible_commands = ["PartnerDropout","EndExperiment",
                            "WaitingRoomPairing","WaitingRoomAfterTraining",
                            "PairID",
                            "Instructions","Director","WaitForPartner","Matcher","Feedback",
                          "Ping","Pong"]
  if (possible_commands.indexOf(command_code) == -1) { //this fires is the command is *not* in the list
    console.log("Received invalid code")
  }
  //if the received code is valid, use switch to select action based on command_code
  else {
    switch (command_code) {
      case "Ping"://if server sends a Ping, send back a Pong and reset the keepAlive counter
        ws_interaction.send(JSON.stringify({response_type:'Pong'}))
        break;
      case "Pong"://server will respond to our Ping with a Pong, which can be ignored
        break;
      case "PartnerDropout": //PartnerDropout: your partner has dropped out
        partner_dropout() //direct client to a screen allowing them to exit the experiment cleanly
        break;
      case "EndExperiment": //EndExperiment: you have finished the experiment
        end_experiment('clean') //direct client to the final screen of the experiment
        break;
      case "WaitingRoomPairing": //WaitingRoomPairing: puts client in waiting room
        waiting_room('Pairing') //direct client to the waiting_room() function
        break;
      case "WaitingRoomAfterTraining": //WaitingRoomAfterTraining: puts client in waiting room
        waiting_room('AfterTraining') //direct client to the waiting_room() function
        break;
      case "PairID": //PairID: server is passing over code to be used during audio pairing
        code = command.pair_id
        break;
      case "Instructions": //Instructions: Show instructions
        //server passes over an instruction in command.instruction_type, plus any other parameters required
        if (command.instruction_type=="Interaction") {
          show_interaction_instructions() //direct client to the appropriate instruction screen
          //when show_interaction_instructions completes it will send a message back to the server,
          //JSON.stringify({response_type:"INTERACTION_INSTRUCTIONS_COMPLETE"})
        }
        break;
      case "WaitForPartner": //WaitForPartner: infinite waiting
        waiting_for_partner() //direct client to waiting screen
        break;
      case "Director": //Direct: director trial
        //to run a director trial we need some extra information, included in
        //the command dictionary (target_object and partner_id) - retrieves these
        //and runs director_trial(...) to get the director's response
        
        director_trial(command.target_meaning,
          command.context_array,
          command.label_choices,
          command.mapping,
          command.block_n,command.trial_n,command.max_trial_n,command.partner_id)
        //when the director enters their label, director_trial sends a response back to the server,
        //which contains quite a lot of information on the trial:
        //JSON.stringify({response_type:'RESPONSE',
        //								participant:unique participant id,
        //								partner:unique_partner_id,
        //							  role:role (director in this case),
        //						    target_object:target_object,response:director's label})
        break;
      case "Matcher": //Matcher: matcher trial
        //Matcher selects an object based on command.director_label and sends back a similar
        //response string
        matcher_trial(command.director_label,command.target_meaning,command.meaning_choices,
          command.mapping,command.block_n,command.trial_n,command.max_trial_n,command.partner_id)
        break;
      case "Feedback": //Feedback: feedback for director or matcher
        display_feedback(command.target,command.guess,command.score,command.mapping,command.break_allowed)
        //when completed, display_feedback sends a response to the server,
        //JSON.stringify({response_type:'FINISHED_FEEDBACK'})
        break;
      default: //this only fires if none of the above fires, which shouldn't happen!
        console.log('oops, default fired')
        break;
    }
  }
}

/*
Note that we check the connection isopen before sending, and use JSON.stringify
to convert the message object to a JSON string - our python server can convert back
from json to a python dictionary.
*/
function send_to_server(message_object) {
  //console.log(message_object)
  if (ws_interaction.readyState === ws_interaction.OPEN) {ws_interaction.send(JSON.stringify(message_object))}
  else {partner_dropout()}
}

function close_socket() {
  ws_interaction.onclose()
}
