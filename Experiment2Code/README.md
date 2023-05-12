shapes_interaction_bs contains the experiment reported as Experiment 2 in Smith, Bowerman & Smith (in prep), where participants go through 2 extension blocks (coloured splats, then either coloured shapes, objects, or emotions). Files not included here are identical to the files for Experiment 1 (e.g. the various data-saving PHP scripts). "_bs" in the name derives from the fact that extensions which were within-subjects in Experiment 1 are *between-subjects* in Experiment 2.

As for Experiment 1, In order to run this code, you need:
1. A server which can host the html, javascript code for the clients, and which can run PHP to save data.
2. A server which can run python and which has secure web sockets. 

You run shapes_interaction_bs/server/shapes_interaction_server_bs.py on the python server, which opens up a port and listens for connections. You then direct participants to the URL for shapes_interaction_bs/shapes_interaction_bs.html, their browser will connection to the server and run through the experiment. The python server is quite verbose and prints a bunch of messages to the terminal showing which clients are sendong/receiving what messages.