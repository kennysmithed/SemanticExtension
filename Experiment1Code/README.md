shapes_interaction contains the experiment reported in the 2022 CogSci proceedings paper,  and as Experiment 1 in Smith, Bowerman & Smith (in prep), where participants go through 4 extension blocks (coloured splats, coloured shapes, objects, emotions).

In order to run this code, you need:
1. A server which can host the html, javascript code for the clients, and which can run PHP to save data.
2. A server which can run python and which has secure web sockets. 

You run shapes_interaction/server/shapes_interaction_server_v3.py on the python server, which opens up a port and listens for connections. You then direct participants to the URL for shapes_interaction/shapes_interaction.html, their browser will connection to the server and run through the experiment. The python server is quite verbose and prints a bunch of messages to the terminal showing which clients are sendong/receiving what messages.