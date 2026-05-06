
$.get("url.txt",function(content){
	var vvlinks="";
	if (content!="") {
		<!-- $("#vlinsk").html('<a target="_blank" href="'+content+'">Url del sitio</a>'); -->
		var vlinname=content.substring(content.lastIndexOf("/")+1);
		var vvlinks=vvlinks+'<a target="_blank" href="'+content+'">URL: '+vlinname+'</a>';		
		$("#vlinsk").html(vvlinks);
		
		vvlinks1=vvlinks;
		var ks = content.split("\n");
		$.each(ks, function(k){
			var vlinname=k.substring(k.lastIndexOf("/")+1);
            var vvlinks1=vvlinks1+'<a target="_blank" href="'+k+'">URL: '+vlinname+'</a> | ';
           });
		$("#vlinsk").html(vvlinks1);
		<!-- alert(content); -->
		}

});

$.get("spotify.txt",function(content){
	
	if (content!="") {
		$("#vlinsk1").html('<a target="_blank" href="'+content+'">Spotify</a>');
		<!-- alert(content); -->
		}
});		
		
$.get("info.txt",function(content){
	if (content!="") {
		var http_reg = /(?:^|[^"'])(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
		content = content.replace(http_reg, '<a href="$1" target="_blank">$1</a>');	
		$("#vlinsk2").html("<hr />"+content.replace(/\n/g, "<br/>\n"));
		<!-- alert(content); -->
		}		
    
});

let posi=1;		
function play(a, vtime = 0){
	if (a < 1 ||  a > cantsongs) {
		return;
	}
	posi=a;		

	let audio = document.getElementById("myaudio");
	audio.src = encodeURIComponent(songfile[a]);
	// alert(songfile[a]+"  ---  "+audio.src);
	audio.currentTime = vtime;
	audio.play();
	document.getElementById("autit").innerHTML = songtitle[a];

	history.pushState(null, "", "?audio=" + a + "&time=" + vtime);

	audio.onended = function() {
		a=a+1;
		if (document.p.autoplay.checked && a < cantsongs)  {
			play(a);
		}
		<!-- alert("The audio has ended"); -->
	};
	audio.onplaying = function() {
		history.pushState(null, "", "?audio=" + a + "&time=" + parseInt(audio.currentTime));
	};
	audio.onpause = function() {
		history.pushState(null, "", "?audio=" + a + "&time=" + parseInt(audio.currentTime));
	};
	window.onbeforeunload = function() {
		history.pushState(null, "", "?audio=" + a + "&time=" + parseInt(audio.currentTime));
	}
}
	   
const secsInc = 15

function incpos(vtime) {
	let audio = document.getElementById("myaudio");		
	if (vtime==2) {
		audio.currentTime = audio.currentTime + secsInc;
	} else {
		audio.currentTime = audio.currentTime - secsInc;
	}

}	   

//play(1);

window.onload = function() {
	const urlParams = new URLSearchParams(window.location.search);
	const audioParam = urlParams.get('audio');
	const timeParam = urlParams.get('time') ? parseInt(urlParams.get('time')) : 0; 

	if (audioParam) { 
		play(parseInt(audioParam), timeParam); 
	} else {
		play(1);
	}
};

