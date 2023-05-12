# -*- coding: utf-8 -*-

##############
##### Python sever interacting with javascript client
##############

# block 0 is white shapes
# block 1 establishes colour associations NEW in v3: doubling the size of this block
# block 2 involves discriminating between colour splats
# block 3 involves discriminating between shapes based on colour (equivalent to v1 block 2)
# block 4 is objects
# block 5 is emotions

# We are using json-encoded dictionaries to send messages back and forth between server and client.

# Each message from the server to the client includes a key command_type which
# lets the client know what action to take.

# Each message from the client to the server includes a key response_type, which
# indicates the kind of response the client is providing.


##############
##### Libraries
##############

# NB this loads the code from the websocket_server folder, which needs to be in the
# same directory as this file.
from websocket_server import WebsocketServer
import random
import json
import csv
from copy import deepcopy
import time


# We regularly ping clients to keep connections open and avoid
# sockets closing - I am assuming a ping every 5 seconds
max_timediff_before_timeout = 1600


######################
##### Globals to manage experiment progress
######################

# We use several global variables to keep track of important information on
# connected clients, which stage of the experiment they are at etc - then when
# we receive a response from a client we can consult this information to see
# where they are in the experiment and what they should do next.

# The main global variable is a dictionary, global_participant_data
# Each connected client has an entry in here, indexed by their ID (an integer assigned
# when they connect). Stored alongside their entry is all the information we need to guide
# them through the experiment, including their client_info (details of the socket etc
# that is required for message passing), the ID of their partner, their current role (e.g.
# director or matcher), their list of trials, the trial counter showing where they are in
# the experiment.
# Keys are client_info, partner, role, interaction_trial_list, shared_trial_counter
global_participant_data = {}

# Lists of client IDs for clients who are in the waiting room waiting to be paired, or in the waiting room 
# waiting for their partner to finish training
unpaired_clients = []
post_training_clients = []

# The list of phases in the experiment - clients progress through this list
# ***NB phases have to be uniquely named***, because we use index() to identify
# where in the experiment the client is.
phase_sequence = ['Start','PairParticipants','Interaction','End']

break_trials = [72,136] #list of trials to offer break after: 72 = block 0 (8) + block 1 (64), 136 = block 2 + block 3 
n_subblocks_per_block = 4 #each director will direct for each target this many times in each block of interaction, *except for block 0*, which is trivial
n_shapes_per_pair = 4 #each pair will get this many shapes to communicate about/with
n_fixed_colours = 4 #each pair will get this many shapes with fixed colours
n_foils = 2 #number of foils on each trial
#each pair will select n_shapes_per_pair from this list
all_shapes = ['square','circle','diamond','star', 'cross', 'pentagon', 'hexagon']
all_signals = ['square','circle','diamond','star', 'cross', 'pentagon', 'hexagon']
colours = ['red','yellow','grey','pink']
objects = ['volcano','banana','city','pig']
emotions = ['angry','happy','sad','inlove']

def random_with_taboo(options_list,taboo_list):
    non_taboo_options = [o for o in options_list if o not in taboo_list]
    return random.choice(non_taboo_options)

def n_random_with_taboo(options_list,n,taboo_list):
    selections = []
    for _i in range(n):
        full_taboo_list = taboo_list + selections
        non_taboo_options = [o for o in options_list if o not in full_taboo_list]
        selections.append(random.choice(non_taboo_options))
    return selections


# shape_colour_correspondences is a dictionary of shape:colours showing which shapes
# should be associated with which colours - if a shape is 'free' this will be a 
# list containing multiple colours
# each block contains n_subblocks_per_block, order randomised within subblock
# shapes is the pair-specific list of assigned shapes
def trial_list(shapes,colour_shape_correspondences):
    #'strict' shapes only have 1 associated colour 
    strict_shapes = [s for s in shapes if len(colour_shape_correspondences[s])==1]

    #block0 - white shapes, foil differs from target shape
    block0 = []
    for _i in range(1): #just 1 rep for block0 because it is so easy
        this_block0_subblock = []
        for target_shape in shapes:
            foil_shapes = n_random_with_taboo(shapes,n_foils,[target_shape])
            target = target_shape + "_white"
            foils = [foil_shape + "_white" for foil_shape in foil_shapes]
            this_block0_subblock.append({'target':target,'foils':foils,'block':0})
        block0 = block0 + shuffle(this_block0_subblock) #using + to get flat structure
    
    #block1 - all shapes appear in characteristic colours, foil differs from target in shape and colour

    block1 = []
    for _i in range(n_subblocks_per_block*2): #NEW in v3 - doubling length of this block
        this_block1_subblock = []
        for target_shape in shapes:
            foil_shapes = n_random_with_taboo(shapes,n_foils,[target_shape])
            #if target_shape is strict, go ahead and pick a random foil colour for each foil, avoiding the target colour
            if target_shape in strict_shapes:
                target_colour = colour_shape_correspondences[target_shape][0]
                foil_colours = []
                for foil_shape in foil_shapes:
                    this_foil_colours = colour_shape_correspondences[foil_shape]
                    this_foil_colour = random_with_taboo(this_foil_colours,[target_colour]+foil_colours)
                    foil_colours.append(this_foil_colour)
            #if the target is free, pick foil colours (which could be strict), and just avoid those colour for the target
            else:
                foil_colours = []
                for foil_shape in foil_shapes:
                    this_foil_colours = colour_shape_correspondences[foil_shape]
                    this_foil_colour = random_with_taboo(this_foil_colours,foil_colours)
                    foil_colours.append(this_foil_colour)
                target_colours = colour_shape_correspondences[target_shape]
                target_colour = random_with_taboo(target_colours,foil_colours)
            target = target_shape + "_" + target_colour
            foils = [foil_shape + "_" + foil_colour for foil_shape,foil_colour in zip(foil_shapes,foil_colours)]
            this_block1_subblock.append({'target':target,'foils':foils,'block':1})
        block1 = block1 + shuffle(this_block1_subblock) #using + to get flat structure
    
    # block2 - a colour instantiated as a colour splat, 
    # foils are splats in different in colour
    # NB doing this for *all* colours
    block2 = []
    for _i in range(n_subblocks_per_block):
        this_block2_subblock = []
        for target_colour in colours:
            #random colours for the foils, avoiding target colour
            foil_colours = n_random_with_taboo(colours,n_foils,[target_colour])
            target = "splat_" + target_colour
            foils = ["splat_" + foil_colour for foil_colour in foil_colours]
            this_block2_subblock.append({'target':target,'foils':foils,'block':2})
        block2 = block2 + shuffle(this_block2_subblock) #using + to get flat structure

    # block3 - a colour instantiated as an object (in its non-typical colour if strict), 
    # foils match target for shape but differ in colour
    # NB doing this for *all* colours
    block3 = []
    for _i in range(n_subblocks_per_block):
        this_block3_subblock = []
        for target_colour in colours:
            #avoid strict shape associated with this colour
            target_shapes = [s for s in shapes if colour_shape_correspondences[s]!=[target_colour]]
            target_shape = random.choice(target_shapes)
            #random colours for the foils, avoiding target colour
            foil_colours = n_random_with_taboo(colours,n_foils,[target_colour])
            target = target_shape + "_" + target_colour
            foils = [target_shape + "_" + foil_colour for foil_colour in foil_colours]
            this_block3_subblock.append({'target':target,'foils':foils,'block':3})
        block3 = block3 + shuffle(this_block3_subblock) #using + to get flat structure

    # block4 - referring to objects
    # easy
    block4 = []
    for _i in range(n_subblocks_per_block):
        this_block4_subblock = []
        for target_object in objects:
            foils = n_random_with_taboo(objects,n_foils,[target_object])
            this_block4_subblock.append({'target':target_object,'foils':foils,'block':4})
        block4 = block4 + shuffle(this_block4_subblock) #using + to get flat structure

    # block5 - referring to emotions
    # easy
    block5 = []
    for _i in range(n_subblocks_per_block):
        this_block5_subblock = []
        for target_emotion in emotions:
            foils = n_random_with_taboo(emotions,n_foils,[target_emotion])
            this_block5_subblock.append({'target':target_emotion,'foils':foils,'block':5})
        block5 = block5 + shuffle(this_block5_subblock) #using + to get flat structure


    #each subblock is shuffled as we construct them, so no need to shuffle here
    return block0 + block1 + block2 + block3 + block4 + block5
    



##############
##### Utility functions
##############

# Returns randomised copy of l, i.e. does not shuffle in place
def shuffle(l):
    return random.sample(l, len(l))

# Converts message string to JSON string and sends to client_id.
# See below for explanation of how client_id indexes into global_participant_data
def send_message_by_id(client_id,message):
    client = global_participant_data[client_id]['client_info']
    print("sending",client_id,message)
    print("last heard from",global_participant_data[client_id]['lastHeardFrom'])
    if time.time()-global_participant_data[client_id]['lastHeardFrom']>max_timediff_before_timeout:
        print('not heard from, disconnecting')
        client_left(client,server)
    else:
        print('sending')
        server.send_message(client,json.dumps(message))
	    

# Checks that all clients listed in list_of_ids are still connected to the server -
# if so, clients will be in global_participant_data
def all_connected(list_of_ids):
    connected_status = [id in global_participant_data for id in list_of_ids]
    if sum(connected_status)==len(list_of_ids):
        return True
    else:
        return False

# Called when a client drops out, used to notify any clients who are still connected
# that this leaves them stranded.
def notify_stranded(list_of_ids):
    for id in list_of_ids:
        if id in global_participant_data:
            #this will notify the participant and cause them to disconnect
            send_message_by_id(id,{"command_type":"PartnerDropout"})



######################
##### Handling clients connecting, disconnecting, sending messages
######################

# Called for every client connecting (after handshake)
# Initialiases that client in global_participant_data
# client objects passed over from the websocket are dictionaries including an id
# key (the client's integer identifier) and a client_info key, which contains
# technical details needed to communicate with this client via the socket
def new_client(client, server):
    client_id = client['id']
    print("New client connected and was given id %d" % client_id)
    global_participant_data[client_id] = {'client_info':client,'lastHeardFrom':time.time()}

    


# Called for every client disconnecting
# Finds all partners and notifies (NB this will have no effect if experiment is over)
# Remove the client from unpaired_clients if appropriate
# Remove the client from global_participant_data
def client_left(client, server):
    client_id = client['id']
    print("Client(%d) disconnected" % client['id'])
    if client_id in unpaired_clients:
        unpaired_clients.remove(client_id)
    # If they have a partner, and if you are not leaving because you are at the End state,
    # notify partner that they have been stranded
    if 'partner' in global_participant_data[client_id]:
        if global_participant_data[client_id]['phase']!='End':
            partner = global_participant_data[client_id]['partner']
            notify_stranded([partner])
    del global_participant_data[client_id]


def ping_all(list_of_ids):
	for client_id in list_of_ids:
		send_message_by_id(client_id,{"command_type":"Ping"})



# Called when the server receives a message from the client.
# Simply parses the message to a dictionaruy using json.loads, reads off
# the response_type, and passes to handle_client_response
def message_received(client, server, message):
	client_id = client['id']
	print("Client(%d) said: %s" % (client_id, message))
	
	#OK, now we have to handle the various possible responses
	response = json.loads(message)
	response_code =  response['response_type']
	#if it's not just a ping or pong
	if response_code not in ["Pong"]:
		#if they have a partner, ping partner to check for problems
		if 'partner' in global_participant_data[client_id]:
			partner_id = global_participant_data[client_id]['partner']
			ping_all([partner_id]) #will hopefully detect closed sockets?
	handle_client_response(client_id,response_code,response)


##########################
### Management of phases
##########################

# We use a list of named phases to manage client progression through the experiment -
# when one phase ends they move onto the next, which determines what messages they
# will receive from the server.
# ***NB phases have to be uniquely named***, because we are using index() to identify
# where in the experiment the client is.

# Simply looks up the client's current phase and moves them to the next phase
def progress_phase(client_id):
	current_phase = global_participant_data[client_id]['phase']
	current_phase_i = phase_sequence.index(current_phase)
	next_phase_i = current_phase_i+1
	next_phase = phase_sequence[next_phase_i]
	enter_phase(client_id,next_phase)

# enter_phase triggers actions associated with that phase.
# Start: immediately progress to the next phase
# PairParticipants: attempt to pair immediately with anyone in the waiting room,
# otherwise send to the waiting room
# Interaction: enter interaction trials
# End: send quit command
def enter_phase(client_id,phase):
    # Update the phase info for this client in the global dictionary
    global_participant_data[client_id]['phase']=phase

    # Nothing actually happens here, but in some experiments we will need to set stuff up
    # when the participant starts the experiment
    if phase=='Start':
        print(client_id, "entering Start")
        progress_phase(client_id)

    # Attempts to pair this client with anyone already in the waiting room
    elif phase=='PairParticipants':
        print(client_id, "entering PairParticipants")
        #send message to the client sending them to waiting room
        #NB we always send them to the waiting room so we can have a uniform treatment at the client 
        #end regardless of whether they had 0 waiting time or not
        send_message_by_id(client_id,{"command_type":"WaitingRoomPairing"})
        unpaired_clients.append(client_id) #add to the unpaired clients list
        # If they can be immediately paired, do so and progress to next phase
        if (len(unpaired_clients)%2 ==0): #If there are exactly 2 people now in unpaired_clients, pair them
            unpaired_one = unpaired_clients[0]
            unpaired_two = unpaired_clients[1]
            #remove from unpaired list
            unpaired_clients.remove(unpaired_one)
            unpaired_clients.remove(unpaired_two)
            # Link them - mark them as each others' partner in global_participant_data
            global_participant_data[unpaired_one]['partner']=unpaired_two
            global_participant_data[unpaired_two]['partner']=unpaired_one
            print(global_participant_data[unpaired_one])
            print(global_participant_data[unpaired_two])
            pair_id = global_participant_data[unpaired_one]['participantID'] + '_' + global_participant_data[unpaired_two]['participantID']


            # Both participants will work through a shared target list, so need to work that out now and 
            # store that info with both clients. 
            # Select random shapes for this pair
            this_pair_shapes = random.sample(all_shapes,n_shapes_per_pair)
            
            #give out random condition
            this_pair_condition = random.choice(["fixed_associations","random_associations"])
            #can give out only one condition like this
            #this_pair_condition = random.choice(["fixed_associations"])
            #this_pair_condition = random.choice(["random_associations"])
            #can give out fixed more than random (for rebalancing a bit)
            #this_pair_condition = random.choice(["fixed_associations","fixed_associations","random_associations"])
            
            print(this_pair_condition)
            if this_pair_condition=="fixed_associations":
                this_pair_n_fixed_colours = n_fixed_colours #each pair will get this many shapes with fixed colours
            else:
                this_pair_n_fixed_colours = 0

            this_pair_shapes = random.sample(all_shapes,n_shapes_per_pair)
                        
            selected_colours = random.sample(colours,this_pair_n_fixed_colours)
            selected_shapes = random.sample(this_pair_shapes,this_pair_n_fixed_colours)
            #set up fixed shapes
            this_pair_correspondences = {s:[c] for s,c in zip(selected_shapes,selected_colours)}
            for s in this_pair_shapes:
                if s not in selected_shapes:
                    this_pair_correspondences[s]=colours
            print(this_pair_correspondences)

            #independent trial lists for them both to direct
            trials1 = trial_list(this_pair_shapes,this_pair_correspondences)
            trials2 = trial_list(this_pair_shapes,this_pair_correspondences)
            
            # Because we are alternating roles we need to interleave the two director lists
            #interleaving code from https://stackoverflow.com/questions/7946798/interleave-multiple-lists-of-the-same-length-in-python
            shared_trials = [val for pair in zip(trials1, trials2) for val in pair] 
            print(shared_trials)

            #record these pieces of info, then move them to the next phase
            for c in [unpaired_one,unpaired_two]:
                global_participant_data[c]['shapes'] = this_pair_shapes
                global_participant_data[c]['shape_colour_correspondences'] = this_pair_correspondences
                global_participant_data[c]['interaction_trial_list'] = shared_trials
                global_participant_data[c]['shared_trial_counter'] = 0
                global_participant_data[c]['pair_id'] = pair_id
                progress_phase(c)

    # Once paired with a partner clients will end up here; Interaction phase starts with instructions,
    # so just send those instructions to the client
    elif phase=='Interaction':
        print('Initalising for interaction')
        send_instructions(client_id,phase)

    # When they hit the end phase, the EndExperiment command will instruct the clients to end the experiment.
    elif phase=='End':
        send_message_by_id(client_id,{"command_type":"EndExperiment"})



#################
### Client loop, handling various client responses
#################

# For some responses, how we handle depends on client phase
# Response_code can be
# CLIENT_INFO: the client passing over some info, in this case just a unique identifier
# INTERACTION_INSTRUCTIONS_COMPLETE: client has finished reading the pre-interaction instructions
# RESPONSE: if the client is in the Director role, this means they have produced a label which
# can now be passed to the matcher. If the client is the Matcher, they have made their selection based
# on the clue provided by the director.
# FINISHED_FEEDBACK: the client has finished looking at the feedback screen indicating their
# success in the interaction.
# NONRESPONSIVE_PARTNER: the client is indicating that their partner has become non-responsive (NB this is 
# not implemented in the client)

def handle_client_response(client_id,response_code,full_response):
    global_participant_data[client_id]['lastHeardFrom']=time.time()
    print('handle_client_response',client_id,response_code,full_response)
    # if client sends Ping, respond with Pong
    if response_code=='Ping':
        send_message_by_id(client_id,{"command_type":"Pong"})
    # client is passing in a unique ID, simply associate that with this client and then send them to the first phase
    elif response_code=='CLIENT_INFO':
        global_participant_data[client_id]['participantID']=full_response['client_info']
        #give them the instructions for the first phase
        enter_phase(client_id,"Start")
    
    #interaction, instructions complete, can initiate actual interaction
    elif response_code=='INTERACTION_INSTRUCTIONS_COMPLETE':
        initiate_interaction(client_id)
    #response returned from director or matcher respectively
    elif response_code=='RESPONSE' and full_response['role']=='Director':
        handle_director_response(client_id,full_response)
    
    elif response_code=='RESPONSE' and full_response['role']=='Matcher':
        handle_matcher_response(client_id,full_response)
	
	#interaction feedback complete, next trial please
    elif response_code=='FINISHED_FEEDBACK':
        swap_roles_and_progress(client_id)
	
    #client reporting a non-responsive partner
    elif response_code=='NONRESPONSIVE_PARTNER':
        pass #not doing anything special with this - the participant reporting
		#the problem leaves, so for their partner it will be as if they have
		#dropped out

    #participant timed out in waiting room while waiting for partner to complete training
    elif response_code=='AFTER_TRAINING_TIMEOUT':
        #remove the timed-out participant from the waiting list
        post_training_clients.remove(client_id)
        #not doing anything other than that - the participant reporting
        #the problem leaves, so for their partner it will be as if they have
        #dropped out



#################
### Interaction, handles trial progression etc
#################

# Runs when participants complete instructions.
# Need to waits until both participants are ready to progress - use the role key for this,
# mark participants as ReadyToInteract when they indicate they have finished reading the instructions.
# Then when both participants are ready we randomly assigns roles of Director and Matcher and
# start the first interaction trial.
def initiate_interaction(client_id):
    partner_id = global_participant_data[client_id]['partner']
    list_of_participants = [client_id,partner_id]
    #checking both players are still connected, to avoid one being left hanging
    if not(all_connected(list_of_participants)):
        notify_stranded(list_of_participants)
    else:
        send_message_by_id(client_id,{"command_type":"WaitForPartner"})
        partner_role = global_participant_data[partner_id]['role']
        #if your partnetr is ready to go, let's go!
        if partner_role=='ReadyToInteract':
            print('Starting interaction')
            #allocate random director and matcher, and run start_interaction_trial for both clients
            for client, role in zip(list_of_participants,shuffle(["Director", "Matcher"])):
                global_participant_data[client]['role'] = role
            start_interaction_trial(list_of_participants)
        else: #else mark you as ready to go, so you will wait for partner
            global_participant_data[client_id]['role']='ReadyToInteract'
            

# Interaction trial - sends director trial instruction to director and wait instruction to matcher
# For director, we need to send the D command_type, with the prompt_word and also the partner_id
# (the partner_id is just sent so that the client can record this in the data file it produces).
def start_interaction_trial(list_of_participants):
    print("in start_interaction_trial")
    #check everyone is still connected!
    if not(all_connected(list_of_participants)):
        notify_stranded(list_of_participants)
    else:
        #figure out who is the director
        director_id = [id for id in list_of_participants if global_participant_data[id]['role']=='Director'][0]
        print(director_id)
        #retrieve their trial list and trial counter
        trial_counter = global_participant_data[director_id]['shared_trial_counter']
        interaction_trial_list = global_participant_data[director_id]['interaction_trial_list']
        ntrials = len(interaction_trial_list)
        #check that the director has more trials to run - if not, move to next phase
        if trial_counter>=ntrials:
            for c in list_of_participants:
                progress_phase(c)
        else: #otherwise, if there are still trials to run
            #retrieve the info we need from global_participant_data
            matcher_id = global_participant_data[director_id]['partner']
            this_pair_shapes = global_participant_data[director_id]['shapes']
            matcher_participant_id = global_participant_data[matcher_id]['participantID']
            target = interaction_trial_list[trial_counter]['target']
            foils = interaction_trial_list[trial_counter]['foils']
            context_array = shuffle([target]+foils)
            block_n = interaction_trial_list[trial_counter]['block']
            for c in list_of_participants:
                print(c)
                this_role = global_participant_data[c]['role']
                print(this_role)
                if this_role=='Director': #send the appropriate instruction to the Director
                    instruction_string = {"command_type":"Director",
                                            "target_meaning":target,
                                            "context_array":context_array,
                                            "label_choices":this_pair_shapes,
                                            #send over info on current trial number etc for display to participant
                                            "block_n":block_n,
                                            "trial_n":trial_counter+1,
                                            "max_trial_n":len(interaction_trial_list),
                                            "partner_id":matcher_participant_id}
                    send_message_by_id(c,instruction_string)
                elif this_role=='Matcher': #and send the appropriate instruction to the matcher
                    send_message_by_id(c,{"command_type":"WaitForPartner"})


# When director responds, all we need to do is relay their label to the matcher. 
def handle_director_response(director_id,director_response):
    print('handle_director_response',director_response)
    matcher_id = global_participant_data[director_id]['partner']
    if not(all_connected([matcher_id])): #the usual check that everyone is still connected
        notify_stranded([director_id])
    else:
        #retrieve their trial list and trial counter
        trial_counter = global_participant_data[director_id]['shared_trial_counter']
        interaction_trial_list = global_participant_data[director_id]['interaction_trial_list']
        target = interaction_trial_list[trial_counter]['target']
        foils = interaction_trial_list[trial_counter]['foils']
        context_array = shuffle([target]+foils)
        block_n = interaction_trial_list[trial_counter]['block']

        #note that director_response['response'] is the clue word the director sent us
        director_participant_id=global_participant_data[director_id]['participantID']
        send_message_by_id(director_id,{"command_type":"WaitForPartner"})
        
        instruction_string = {"command_type":"Matcher",
                                "target_meaning":target,
                                "director_label":director_response['response'],
                                #send over info on current trial number etc for display to participant
                                "meaning_choices":context_array,
                                "block_n":block_n,
                                "trial_n":trial_counter+1,
                                "max_trial_n":len(interaction_trial_list),            
                                "partner_id":director_participant_id}
        send_message_by_id(matcher_id,instruction_string)

# When the matcher responds with their guess, we need to send feedback to matcher + director.
# Both clients are sent a feedback command: command_type F, then multiple pieces of info including
# score, the intended target, the clue provided, etc etc
def handle_matcher_response(matcher_id,matcher_response):
    print("in handle_matcher_response")
    director_id = global_participant_data[matcher_id]['partner']
    if not(all_connected([director_id,matcher_id])):
        notify_stranded([director_id,matcher_id])
    else:
        #easiest way to access what the target was is to look it up in the director's trial list
        trial_n = global_participant_data[director_id]['shared_trial_counter']
        target = global_participant_data[director_id]['interaction_trial_list'][trial_n]['target']
        #participants have an option for a self-paced break every n_trials_before_break trials
        if (trial_n + 1) in break_trials:
            break_option = 'true'
        else:
            break_option = 'false'
        guess = matcher_response['response']
        if target==guess:
            score=1
        else:
            score=0
        feedback = {"command_type":"Feedback","score":score,
                    "target":target,"guess":guess,
                    "break_allowed":break_option}
        for c in [matcher_id,director_id]: #send to both clients
            send_message_by_id(c,feedback)



# Each client comes here when they signals they are done with feedback from an interaction trial.
# The first client who returns will set their role to 'WaitingToSwitch'.
# The second client to return will then trigger the next trial, then we can use the role of that
# second client to figure out who will be director and matcher at the next trial.
def swap_roles_and_progress(client_id):
    print('swap roles',client_id)
    partner_id = global_participant_data[client_id]['partner']
    if not(all_connected([client_id,partner_id])):
        notify_stranded([client_id,partner_id])
    else:
        #increment global counter - both participants will do this independently when they reach this point
        global_participant_data[client_id]['shared_trial_counter']+=1

        this_client_role = global_participant_data[client_id]['role']
        partner_role = global_participant_data[partner_id]['role']
        #If your partner is already ready, then switch roles and progress
        if partner_role=='WaitingToSwitch':
            if this_client_role=='Director': #if you were director for this trial then
                global_participant_data[client_id]['role'] = "Matcher" #next time you will be Matcher...
                global_participant_data[partner_id]['role'] = "Director" #..and your partner will be Director
            else:
                global_participant_data[client_id]['role'] = "Director" #otherwise the opposite
                global_participant_data[partner_id]['role'] = "Matcher"
            #next trial
            start_interaction_trial([client_id,partner_id])
        #Otherwise your partner is not yet ready, so just flag up that you are 
        else:
            #NOT sending to wait here - it causes problems because they both end up waiting simultaneously
            #send_message_by_id(client_id,{"command_type":"WaitForPartner"})
            global_participant_data[client_id]['role'] = "WaitingToSwitch"



####################
### Instructions between blocks
####################

# Fairly simple, just send over a command_type Instructions message to the client, with instructon_type set to "Interaction"
def send_instructions(client_id,phase):
    if phase=='Interaction':
        pair_id = global_participant_data[client_id]['pair_id']
        send_message_by_id(client_id,{"command_type":"PairID","pair_id":pair_id})
        #set role
        global_participant_data[client_id]['role'] = "ReadingInstructions"
        send_message_by_id(client_id,{"command_type":"Instructions","instruction_type":"Interaction"})

#######################
### Start up server
#######################

PORT=9025 #this will run on port 9025

#standard stuff here from the websocket_server code
print('starting up')
server = WebsocketServer(PORT,'0.0.0.0')
server.set_fn_new_client(new_client)
server.set_fn_client_left(client_left)
server.set_fn_message_received(message_received)
#server.set_timeout(10)
server.run_forever()
