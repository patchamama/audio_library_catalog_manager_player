<html>
<head>
</head>
<body>

<?php 
	$vurl="";
	if (isset($_GET["url"])) {
		$vurl=$_GET["url"]; 
		}
		
function special_coding($a) {
	$a=rawurlencode($a);	 
	$a=str_replace("http%3A%2F%2F","http://",$a);
	$a=str_replace("%3A%",":",$a);
	$a=str_replace("%2F","/",$a);
	return $a;
}		
?>
<hr />
<video width="320"  id="myaudio" src="<?php echo (special_coding($vurl)); ?>" controls></video>
<a href="<?php echo special_coding($vurl); ?>"><img src='https://chart.googleapis.com/chart?cht=qr&chl=<?php echo urlencode(special_coding($vurl)); ?>&chs=180x180&choe=UTF-8&chld=L|2' rel='nofollow' alt='qr code' /><a href='https://www.qr-code-generator.com' border='0' style='cursor:default'  rel='nofollow'></a> <a href='https://www.qr-code-generator.com' border='0' style='cursor:default'  rel='nofollow'></a>
<image src="<?php echo special_coding($vurl); ?>" />
<br />
<?php 
echo "<a href='".(special_coding($vurl))."'>".htmlentities(special_coding($vurl))."</a><br />";
?>
<hr />
<form>
  <input len="150" size="150" type="text" name="url" value="<?php echo ($vurl); ?>">
  <input type="submit">
</form> 
<hr />
<?php 
	echo "<p><a href='".($vurl)."'>".($vurl)."</a></p>";
	echo "URL: <a href='".(($vurl))."'>".htmlentities($vurl)."</a><br />";
	echo "rawurlencode: <a href='".(rawurlencode($vurl))."'>".htmlentities(rawurlencode($vurl))."</a><br />";
	echo "special_coding: <a href='".(special_coding($vurl))."'>".htmlentities(special_coding($vurl))."</a><br />";
	echo "urlencode: <a href='".(urlencode($vurl))."'>".htmlentities(urlencode($vurl))."</a><br />";
	echo "urldecode: <a href='".(urldecode($vurl))."'>".htmlentities(urldecode($vurl))."</a><br />";
	echo "addcslashes: <a href='".(addcslashes($vurl))."'>".htmlentities(addcslashes($vurl))."</a><br />";
	echo "addslashes: <a href='".(addslashes($vurl))."'>".htmlentities(addslashes($vurl))."</a><br />";
	echo "quotemeta: <a href='".(quotemeta($vurl))."'>".htmlentities(quotemeta($vurl))."</a><br />";
	echo "htmlspecialchars: <a href='".(htmlspecialchars($vurl))."'>".htmlentities(htmlspecialchars($vurl))."</a><br />";
	echo "stripslashes: <a href='".(stripslashes($vurl))."'>".htmlentities(stripslashes($vurl))."</a><br />";
	echo "stripcslashes: <a href='".(stripcslashes($vurl))."'>".htmlentities(stripcslashes($vurl))."</a><br />";
	echo "strip_tags: <a href='".(strip_tags($vurl))."'>".htmlentities(strip_tags($vurl))."</a><br />";
	echo "html_entity_decode: <a href='".(html_entity_decode($vurl))."'>".htmlentities(html_entity_decode($vurl))."</a><br />";
	echo "htmlentities: <a href='".(htmlentities($vurl))."'>".htmlentities(htmlentities($vurl))."</a><br />";
	echo "htmlspecialchars_decode: <a href='".(htmlspecialchars_decode($vurl))."'>".htmlentities(htmlspecialchars_decode($vurl))."</a><br />";
	// echo "<p><a href='".($vurl)."'>".($vurl)."</a></p>";
	// echo "<p><a href='".($vurl)."'>".($vurl)."</a></p>";
?>
</body>
</html>