<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="es">
<head><title>Todo todo</title>
<meta http-equiv=Content-Type content="text/html; charset=utf-8">
</head>
<body>

<script>

function tonextrandomsong(vtime) {
	// alert(vtime);
	if (vtime==0) {
		nextrandomsong(vtime);
		vtitle=document.getElementById("mytitle").innerHTML;
		while (newmp3.indexOf("#.") > 0) {
			nextrandomsong(vtime);
			}
	} else {		
		var audio = document.getElementById("myaudio");		
		if (vtime==2) {
			audio.currentTime = audio.currentTime + 15;
			} else {
			audio.currentTime = audio.currentTime - 15;
			}
		}
}

function nextrandomsong(vtime) {
    var links = document.getElementsByTagName('a');
    // for(var i = 0; i< links.length; i++){
      // alert(links[i].href);
    // }
    max=links.length;
    min=1;
    i=Math.floor(Math.random() * (max - min + 1) + min);

    newmp3=links[i].href;
    // newmp3=newmp3.replace("youtube#","");
    vnlower=newmp3.toLowerCase();

    vtitle=document.getElementById("mytitle").innerHTML;
    vtitle=vtitle.replace("<p>","").replace("</p>","").replace("<br />","");
    document.getElementById("mytitle").innerHTML = ""+(i)+"#. ("+newmp3+") "+vtitle+"";		
    
    while ( (newmp3.indexOf("youtube.com") > 0) || (vnlower.indexOf(".mp3") == -1) ) {
	i=Math.floor(Math.random() * (max - min + 1) + min);
	newmp3=links[i].href;
	// newmp3=links[i].href.replace("mp3-youtube#","");
	// newmp3=newmp3.replace("youtube#","");
	vnlower=newmp3.toLowerCase();
	}

    newmp3=newmp3.replace("mp3-youtube#","");
    newmp3=newmp3.replace("mp3-youtube5#","");
    newmp3=newmp3.replace("youtube#","");
    // alert(newmp3);
    vtitle=vtitle.replace("<p>","").replace("</p>","").replace("<br />","");
    vtitle=document.getElementById("mytitle").innerHTML;
    document.getElementById("mytitle").innerHTML = ""+(i)+"##. ("+newmp3+") "+vtitle+"";	
    playnow(newmp3);
    
    
    // var arr = [], l = document.links;
    // if (document.main.auto.checked)  {
	// for(var i=0; i<l.length; i++) {
	    // arr.push(l[i].href);
	    // }
	
	// // playnow(arr[i]);
	// }
    
    <!-- alert("The audio has ended"); -->
}

function playnow(vsrc){
    // alert("111."+vsrc);
    
    if (vsrc.indexOf("=") > 1) {
	var vnewsrc = vsrc.split('=');
	vsrc=vnewsrc[1];
    }

    // alert(vsrc);
    vsrc=vsrc.replace(/\\/g, '');
    // replace("\'","'");
    vtitle=vsrc.replace("mp3-youtube/","");
    vtitle=vtitle.replace("%20"," ");
    vtitle=vtitle.replace(/\\/g, '');
    vtitle=vtitle.replace(/%20/g, ' ');
    vtitle=decodeURIComponent(vtitle);
    vsource='http://server.patchamama.com/_audios/'+vsrc;

	vtip="";
	if (vsrc.indexOf(".mp4") > 0) {
		// vtip="Vid";
		document.getElementById("myplayer").innerHTML = '<video width="620"  id="myaudio" src="" controls></video>';
	} else {
		document.getElementById("myplayer").innerHTML = '<audio width="620"  id="myaudio" src="" controls autoplay> ';
		}
	if (document.main.qrcode.checked) {
	// alert(vsrc);
	window.open("qrcode.php?url="+vsource);   
    }
    else if (document.main.newwind.checked) {
	// alert(vsrc);
	window.open(vsource);   
    } else {
		// document.getElementById("myplayerVid").style.visibility = 'hidden';
		// document.getElementById("myplayer").style.visibility = 'hidden';
		// document.getElementById("myplayer"+vtip).style.visibility = 'visible'; 
		// var audio1 = document.getElementById("myaudio");
		// var video1 = document.getElementById("myaudioVid");
		// audio1.pause();
		// video1.pause();
		
		document.getElementById("playercomponent").style.visibility = "visible"; 
		
		var audio = document.getElementById("myaudio"+vtip);		
		audio.src=vsource;
		audio.play();
		audio.onended = function() {
		if (document.main.auto.checked) {
			nextrandomsong();
			vtitle=document.getElementById("mytitle"+vtip).innerHTML;
			
			while (vsrc.indexOf("#.") > 0) {
				nextrandomsong();
				}
			}
		};
    }
    document.getElementById("mytitle"+vtip).innerHTML = ""+vtitle+"";
    
    
}



var player= document.getElementById('player');

player.addEventListener('canplaythrough', function() { 
   player.play();
}, false);
</script>



<?php
  if (!isset($_GET[filter])) {
    $_GET[filter] = "";
  }
?>
<div style="position: fixed; background: #336699; width: 100%; top: 0; height: fit-content; " id="menu">
<form name="main">
<a href="index.html">Inicio</a> ||
<a href="?filter=">Todo</a> |
<a href="?filter=audible">Audibles*</a> |
<a href="?filter=TTS">TTS</a> |
<a href="?filter=Dummies">Dummies</a> |
<a href="?filter=chess">Chess</a> |
<a href="?filter=Deutsch">Deutsch</a> |
<a href="?filter=ajedrez">Ajedrez</a> |
<a href="?filter=ciclismo">Ciclismo</a> |
<a href="?filter=youtube">Youtube</a> |
<a href="?filter=mp3-youtube">Mp3</a> |
<a href="?filter=mp3-youtube5">Mp3-5</a> |
<a  target="_blank"  href="https://open.spotify.com/queue">Spotify</a> |
<a href="?filter=Duo">Conversaciones</a> 
<br />
<input name="filter" value="<?php echo $_GET[filter]; ?>" ><input type="submit">
Random: <input name="auto" type="checkbox" >
NewWin: <input name="newwind" type="checkbox" >
QrCode: <input name="qrcode" type="checkbox" >
<hr />

<div id="playercomponent">
<div   id="mytitle" ></div>
<input type="button" href="#" onclick="javascript:tonextrandomsong(0);" value=">>"> | 
<input type="button" href="#" onclick="javascript:tonextrandomsong(1);" value="-15"> | 
<input type="button" href="#" onclick="javascript:tonextrandomsong(2);" value="+15"> 
<div id="myplayer">
<audio width="620"  id="myaudio" src="" controls autoplay> 
</div>
</div>

</div>
<div>
<br /><br /><br /><br /><br /><br />

<?php
// http://patchamama.com/_audios/index.php
$vfilter="";
$vfilterAudible=False;
if (isset($_GET["filter"])) {
    $vfilter=$_GET["filter"].".*";
    $vfilter=trim($vfilter);
    // $vfilter=str_replace($vfilter," ","|");
    }
// echo " >>> ".$vfilter."...";
echo "<br /><hr />";
if 	($vfilter=="audible.*") {
    $vfilter=".*";
    $vfilterAudible=True;
    }
$vfilter = tostr($vfilter);
$vsearchwebpattern="";
$vsearchwebsearch="";

function date_compare($a, $b) {
    $t1 = strtotime($a['datetime']);
    $t2 = strtotime($b['datetime']);
    return ($t1 - $t2)* (-1);   // 
} 

function findpatternweb($vsearchwebpattern, $b) {

	$vss="";		
	preg_match('/.'.$vsearchwebpattern.'/i', (" ".$b." "), $vss);
	if (!$vss) {						
		preg_match('/.*\d+ \- (.*)[\.]+mp3.*/i', (" ".$b." "), $vss);
	}
	if (!$vss) {						
		preg_match('/(.*)[\.]+mp3.*/i', (" ".$b." "), $vss);
	}	
	
	if ($vss) {
		$vss=$vss[1];
	} else {
		$vss=$b;
		$vss=str_replace("..mp3","",$vss);
		$vss=str_replace(".mp3","",$vss);
	}
	$vss=str_replace(".mp3","",$vss);
	$vss=str_replace("."," ",$vss);	
	$vss=str_replace("  "," ",$vss);
	return trim($vss);
}

$dirs = array_filter(glob('*'), 'is_dir');
//if (isset($_GET["sort"])) {
    //usort($dirs, 'date_compare'); 
  //  }
$vsearchwebpattern="";
$vsearchwebsearchurl="";
$vsearchweb="";

foreach ($dirs as $id) {
    $id1 = tostr($id);
    if (preg_match('/'.$vfilter.'/i', $id1)) {
		if ($vfilterAudible) {
			$vnotaudible = ((" ".stripos($id1,"tts")>0) || (stripos(" ".$id1,"chess")>0) || (stripos(" ".$id1,"uribe")>0) || (stripos(" ".$id1,"cienciaes")>0) || (stripos(" ".$id1,"_")>0) );
			if (!$vnotaudible) {
				echo "\r\n".'<a href="'.($id).'">'.($id).'</a><br />';
				}	
			}else{
			echo "\r\n".'<a href="'.($id).'">'.($id).'</a><br />';
			}

	}
    }
    

    echo "<hr />";
    if 	($vfilter<>".*") {
	$files=array();
	$dirs = array_filter(glob('*'), 'is_dir');
	include("_getid3/getid3.php"); 
	$getID3 = new getID3;
		
	foreach ($dirs as $id) {
	    // echo '<a href="'.($id).'">'.($id).'</a><br />';
	    $vfiledir=array_filter(glob($id.'/*'));			
	    
	    // usort($vfiledir, 'date_compare');
	    foreach ($vfiledir as $id) {
		$id1 = tostr($id);
		list($a, $b) = explode('/', $id);
		$b1 = tostr($b);

		
		$vfollow = False;
		// print("[".$id."<>"."mp3-youtube"."]"); 
		if (  ($vfilter==tostr("youtube").".*") or ( ($vfilter==tostr("mp3-youtube").".*") and (stripos("  ".$id,"mp3-youtube")>0) ) or ( ($vfilter==tostr("mp3-youtube5").".*") and (stripos("  ".$id,"mp3-youtube5")>0) ) )  {
		    $vfollow = True;
		    }
		
				
		if ( (preg_match('/'.$vfilter.'/i', $b1)) or ($vfollow) ) {

		    $vyoutube="";				
		    preg_match('/.*youtube\-(.*)\.mp.*/', ($id), $vyoutube); 
		    if ($vyoutube) {
			// print(">>>".strtolower($id)."<<<");
			// print_r($vyoutube);	//https://www.youtube.com/watch?v=		
			$vyoutube=' <a target="_blank" href="https://www.youtube.com/watch?v='.($vyoutube[1]).'">'.'<image src="youtube.png" width="15px"  />'.'</a>';
			}					
		    else{
			$vyoutube="";
			if (  (stripos($b,"-")>0) ) {  //(stripos($id,"youtube")>0) and
			    $vvvvv="";
			    preg_match('/.*\-(.{11})\.mp.*/', ($id), $vvvvv);
				$ddd=trim($vvvvv[1]);
			    if ( ($vvvvv) && (!strpos($ddd, " ")>0) ){				
				// if (stripos($ddd," ")>0) {
				    $vyoutube=' <a target="_blank" href="https://www.youtube.com/watch?v='.($ddd).'">'.'<image src="youtube.png" width="15px"  />'.'</a>';
				    // }
				}	
			    }
			}
		    
		    if ((stripos($b1,".epub")>0) || (stripos($b1,".mp3")>0) || (stripos($b1,".mp4")>0) ) {
			$vimag="";
			if ((stripos($b1,".epub")>0) ) {
			    $vimag='<image src="ebook.png" width="15px"  />';
			    }
			if ((stripos($b1,".mp3")>0)) {
			    $vimag='<image src="music.png" width="15px" />';
			    }
			if ((stripos($b1,".mp4")>0)) {
			    $vimag='<image src="video.png" width="10px" />';
			    }
				
		
			$fileref=addslashes($id); // str_replace("'","\'", $id);
			
		$file = $getID3->analyze($fileref);
		$playtime_seconds = $file['playtime_seconds'];
		$vsize= gmdate("H:i:s", $playtime_seconds);			
			
			if ($vlastdir==$a) {	
				// if ($vsearchwebpattern) {
					// $vsearchwebsearchurl=findpatternweb($vsearchwebpattern, $b);
					// $vsearchweb=" <a href='#' onclick='javascript:window.open(".'"'.$vsearchwebsearch.$vsearchwebsearchurl.'"'.");return false;' ><image src='search.png' width='15px' /></a>"; 
					// }
				$vsearchwebpattern="";
				$vsearchwebsearchurl="";
				$vsearchweb="";
				if (file_exists($a."/search.txt")) {
					
					// $vsearchweb="1111";
					$ff = fopen($a."/search.txt", 'r');
					while (!feof($ff)) { 				
						$vline = fgets($ff,9999);						
						if (strpos($vline, "|")>0) {
							$partes = explode("|", $vline);
							$vsearchwebpattern=trim($partes[0]);
							$vsearchwebsearch=trim($partes[1]);
							
							$vsearchwebsearchurl=findpatternweb($vsearchwebpattern, $b);
                            
                            $vsearchwebsearch=str_replace($vsearchwebsearch, "patchamama.com","server.patchamama.com");
							$vsearchweb=$vsearchweb." <a href='#' onclick='javascript:window.open(".'"'.$vsearchwebsearch.$vsearchwebsearchurl.'"'.");return false;' ><image src='search.png' width='15px' /></a>"; 
						}
					}
					fclose($ff);
					} else {
						// $vsearchweb="NO encontrado: ".$a."/search.txt";
					}
					
			    echo "\r\n".'.......'.$vimag.'<a href="#'.($fileref).'" id="myLink" onclick="playnow(\''.($fileref).'\');return false;" >'.($b).' ('.($vsize).')</a>'.($vyoutube).$vsearchweb.'<br />';
			}else{
				// $vsearchweb="0000".$a."/search.txt";
			    // echo '+<a href="'.($a).'">'.($a).'</a>/<a href="'.($id1).'">'.($b).'</a><br />';
				$vsearchwebpattern="";
				$vsearchwebsearchurl="";
				$vsearchweb="";
				if (file_exists($a."/search.txt")) {
					
					// $vsearchweb="1111";
					$ff = fopen($a."/search.txt", 'r');
					while (!feof($ff)) { 				
						$vline = fgets($ff,9999);						
						if (strpos($vline, "|")>0) {
							$partes = explode("|", $vline);
							$vsearchwebpattern=trim($partes[0]);
							$vsearchwebsearch=trim($partes[1]);  
							
							$vsearchwebsearchurl=findpatternweb($vsearchwebpattern, $b);
                            
                            //$vsearchwebsearch=str_replace($vsearchwebsearch, "patchamama.com","server.patchamama.com");
							$vsearchweb=$vsearchweb." <a href='#' onclick='javascript:window.open(".'"'.$vsearchwebsearch.$vsearchwebsearchurl.'"'.");return false;' ><image src='search.png' width='15px' /></a>"; 
						}
					}
					fclose($ff);
					} else {
						// $vsearchweb="NO encontrado: ".$a."/search.txt";
					}
			    echo '<image src="folder.png" width="10px" /><a href="'.($a).'">'.($a).'</a><br />';
			    echo "\r\n".'.......'.$vimag.'<a href="#'.($fileref).'" id="myLink" onclick="playnow(\''.($fileref).'\');return false;" >'.($b).' ('.($vsize).')</a>'.($vyoutube).$vsearchweb.'<br />';
			    }
			$vlastdir=$a;
			}
		    }
		}	
	    // $files = array_merge($files, $vfiledir);
	    // print_r($vfiledir);
	    }	
    } 	
    
// print_r($files);
    
// print_r( $dirs); 

function tostr($vst)
{
    $vst = strtolower($vst);
    $vst = str_ireplace("á","a",$vst);
	$vst = str_ireplace("â","a",$vst);
    $vst = str_ireplace("é","e",$vst);
    $vst = str_ireplace("í","i",$vst);
    $vst = str_ireplace("ó","o",$vst);
    $vst = str_ireplace("ú","u",$vst);
    $vst = str_ireplace("ñ","n",$vst);
    $vst = str_ireplace("ö","o",$vst);
    $vst = str_ireplace("à","a",$vst);	
    $vst = str_ireplace("è","e",$vst);		
    $vst = str_ireplace("ë","e",$vst);		
	
    $vst = str_ireplace("sch","ch",$vst);			
    $vst = str_ireplace("sh","ch",$vst);			
    $vst = str_ireplace("("," ",$vst);
    $vst = str_ireplace(")"," ",$vst);
    // $vst = str_ireplace("k","c",$vst);
    $vst = str_ireplace("s","c",$vst);
    $vst = str_ireplace("z","c",$vst);
	$vst = str_ireplace("Ž","c",$vst);
	$vst = str_ireplace("ž","c",$vst);
	

    $vst = str_ireplace("b","v",$vst);
    // $vst = str_ireplace("h","",$vst);
    // $vst = str_ireplace("m","n",$vst);
    // $vst = str_ireplace("g","j",$vst);	
    // $vst = str_ireplace("ll","y",$vst);	
    $vst = str_ireplace("y","i",$vst);
    $vst = str_ireplace("  "," ",$vst);
    $vst = str_ireplace("  "," ",$vst);
    
    return $vst;  
}

?>
</form>

</div>
</body>
</html>



