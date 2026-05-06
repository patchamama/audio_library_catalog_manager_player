
$.get("url.txt",function(content){
	let vvlinks="";
	if (content!="") {
		const vlinname=content.substring(content.lastIndexOf("/")+1);
		const vvlinks=vvlinks+'<a target="_blank" href="'+content+'">URL: '+vlinname+'</a>';		
		$("#vlinsk").html(vvlinks);
		
		let vvlinks1=vvlinks;
		const ks = content.split("\n");
		$.each(ks, function(k){
			const vlinname=k.substring(k.lastIndexOf("/")+1);
            vvlinks1=vvlinks1+'<a target="_blank" href="'+k+'">URL: '+vlinname+'</a> | ';
           });
		$("#vlinsk").html(vvlinks1);
		}

});

$.get("spotify.txt",function(content){
	
	if (content!="") {
		$("#vlinsk1").html('<a target="_blank" href="'+content+'">Spotify</a>');
		}
});		
		
$.get("info.txt",function(content){
	if (content!="") {
		const http_reg = /(?:^|[^"'])(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
		content = content.replace(http_reg, '<a href="$1" target="_blank">$1</a>');	
		$("#vlinsk2").html("<hr />"+content.replace(/\n/g, "<br/>\n"));
		}		
    
});

let posi=1;		
function play(a, vtime = 0){
	if (a < 1 ||  a > cantsongs) {
		return;
	}
	posi=a;		

	let audio = document.getElementById("myaudio");
	//const songfileName = songfile[a].normalize('NFC');
	//const songfileName = songfile[a].replace(/ó/g, "%F3").replace(/Ó/g, "%D3")  
	//.replace(/ó/g, "o%cc%81") //.replace(/á/g, "%E1").replace(/é/g, "%E9").replace(/í/g, "%ED").replace(/ú/g, "%FA").replace(/ñ/g, "%F1").replace(/Ñ/g, "%D1").replace(/ /g, "%20");
	//alert(songfile[a]+"  ---  "+songfileName);
	//audio.src = (songfileName); // encodeURIComponent
	
	// Codificamos el nombre del archivo para evitar errores con tildes o espacios
    const encodedFileName = encodeURIComponent(songfile[a]);

    // Si los MP3 están en el mismo directorio:
    audio.src = encodedFileName;
	
	audio.currentTime = vtime;
	audio.play();
	document.getElementById("autit").innerHTML = songtitle[a];

	audio.addEventListener("error", function() {
		console.error("Error loading audio file: " + songfile[a]+"  ---  "+audio.src);
		
	  });

	history.pushState(null, "", "?audio=" + a + "&time=" + vtime);

	audio.onended = function() {
		a=a+1;
		if (document.p.autoplay.checked && a < cantsongs)  {
			play(a);
		}
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

