<?php
$json = file_get_contents('php://input');
$obj = json_decode($json, true);
#$username = "ksmith7";
$username = "project1";
$directory = $obj["directory"];
$filename = $obj["filename"];
$server_data = '/home/'.$username.'/server_data/shapes/'.$directory;
$path = $server_data."/".$filename;
if (substr(realpath(dirname($path)), 0, strlen($server_data))!=$server_data) {
    error_log("attempt to write to bad path: ".$path);
} else {
    $outfile = fopen($path, "a");
    fwrite(
        $outfile,
        sprintf($obj["filedata"])
    );
    fclose($outfile);
};
?>
