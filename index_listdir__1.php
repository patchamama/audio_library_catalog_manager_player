<!DOCTYPE html>
<html lang="es">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
</head>
<body>
<?php 
// open this directory 
$myDirectory = opendir(".");
// get each entry
while($entryName = readdir($myDirectory)) {
    $dirArray[] = $entryName;
}
// close directory
closedir($myDirectory);
//  count elements in array
$indexCount = count($dirArray);
// Print ("$indexCount files<br>\n");
// sort 'em
sort($dirArray);
// print 'em

// loop through the array of files and print them all
for($index=0; $index < $indexCount; $index++) {
		$vfile = $dirArray[$index];
		$vyoutube="";
		
		$vvvvv = "";
		preg_match('/.*\-(.{11})\.mp.*/', ($vfile), $vvvvv);
		$ddd=trim($vvvvv[1]);
		if ( ($vvvvv) && (!strpos($ddd, " ")>0) ){				
			$vyoutube=' <a target="_blank" href="https://www.youtube.com/watch?v='.($ddd).'">'.'<image src="../youtube.png" width="15px"  />'.'</a>';
			}
				
		if ( (strpos($vfile, ".mp3")>0) ){
			if (substr("$dirArray[$index]", 0, 1) != "."){ // don't list hidden files
			print("\r\n<BR><a href=\"$dirArray[$index]\">$dirArray[$index]</a> $vyoutube");


			}

    }
}

?>
</body>
</html>