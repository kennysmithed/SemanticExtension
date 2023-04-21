<?php
$json = file_get_contents('php://input');
$obj = json_decode($json, true);
#$username = "ksmith7";
$username = "project1";
$participant_id = $obj["participant_id"];
$server_data = '/home/'.$username.'/server_data/shapes/participant_data'.$directory;
$path = $server_data."/s_".$participant_id.".csv";
if (substr(realpath(dirname($path)), 0, strlen($server_data))!=$server_data) {
    error_log("attempt to write to bad path: ".$path);
} else {
	$duplicate_string = 'NotDuplicate';
	if (file_exists($path)) {
		$duplicate_string = 'Duplicate';
	}
	print $duplicate_string;
};
