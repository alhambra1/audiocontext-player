/**
* Written by Gilad Barkan, 2017
* Inspired by:
* http://www.creativebloq.com/netmag/how-manipulate-and-visualise-web-audio-91413066
* https://stackoverflow.com/questions/32563298/audiocontext-issue-with-safari
* Covered by the "Do whatever the heck you want with it" licence,
* the full text of which is: Do whatever the heck you want with it.
* [Attributed to http://stackoverflow.com/users/14860/paxdiablo]
*
**/
var AudioContextPlayer = (function(){
	var obj = {};

	obj.ctx = new (window.AudioContext || window.webkitAudioContext)();
	obj.analyser = obj.ctx.createAnalyser();
	obj.proc = obj.ctx.createScriptProcessor(1024, 1, 1);

	obj.analyser.connect(obj.proc);

	obj.proc.connect(obj.ctx.destination);
	obj.analyser.connect(obj.ctx.destination);

	var data = new Uint8Array(obj.analyser.frequencyBinCount);

	obj.onProcess = function(){
		obj.analyser.getByteFrequencyData(data);
		// Do something with 'data' array
	};

	obj.waitForAudioObjectInit = function(maybeReadyObj){
		return new Promise(function(resolve, reject){
			function recur(timeToWait, time, interval){
				if (time < 0)
					reject({message: 'Waited ' + timeToWait + ' ms for audio object to initialize, id: ' + maybeReadyObj.id});

				if (typeof maybeReadyObj.play != 'function')
					setTimeout(() => recur(timeToWait, time - interval, interval), interval);
				else
					resolve(maybeReadyObj.play());
			}

			recur(5000, 5000, 300);
		});
	};

	// https://stackoverflow.com/questions/32563298/audiocontext-issue-with-safari
	obj.makeAudioObject = function(parentObj, id, arrayBuffer){
		parentObj[id] = {};

		var asset = Object.assign(parentObj[id], {
			id: id,
			arrayBuffer: arrayBuffer,
			currentTime: 0,
			offset: 0,
			volume: config.audio_start_volume,
			pause: () => undefined
		});

		obj.ctx.decodeAudioData(asset.arrayBuffer, function(buffer){
				// default volume
				//// support both webkitAudioContext or standard AudioContext
				asset.gain = obj.ctx.createGain ? obj.ctx.createGain() : obj.ctx.createGainNode();

				// Initialize all songs to 35% volume (max volume is limited to 70%)
				asset.gain.gain.value = asset.volume;
				asset.play = function(){
					return new Promise(function(resolve, reject){
						try {
							asset.source = obj.ctx.createBufferSource(); // creates a sound source
							asset.source.buffer = buffer; // tell the source which sound to play
							asset.source.connect(asset.gain); // connect the source to the context's destination (the speakers)
							asset.source.onended = function(){
								if (asset.forceStop)
									return;
								asset.offset = 0;
								asset.isPlaying = false;
								window.resetAudioPlayer(asset);
							}
							asset.gain.connect(obj.ctx.destination);
							asset.duration = asset.source.buffer.duration;
							asset.startedAt = obj.ctx.currentTime;
							asset.isPlaying = true;
							// play the source now
							// support both webkitAudioContext or standard AudioContext
							asset.source.noteOn ? asset.source.noteOn(0) : asset.source.start(0, asset.offset);
							resolve(true);

						} catch (error){
							console.error('AudioContextPlayer.ctx.decodeAudioData error: ', error});
							reject(error);
						}
					});
				};

				asset.pause = function(){
					if (!asset.isPlaying)
						return;
					asset.forceStop = true;
					asset.offset = asset.getCurrentTime();
					asset.source.stop();
					asset.isPlaying = false;
					setTimeout(() => asset.forceStop = false, 100);
					//source = obj.ctx.createBufferSource(); // creates a sound source
					//asset.gain.disconnect();
					//source.noteOff ? source.noteOff(0) : source.stop(0);
				};
				asset.toggleVolume = function(muteSound){
					if (muteSound) {
						asset.gain.gain.value = 0;
					} else {
						asset.gain.gain.value = 1;
					}
				};
				asset.setVolume = function(volume){
					asset.volume = volume / 100;
					asset.gain.gain.value = asset.volume;
				};
				asset.getCurrentTime = function(){
					if (asset.isPlaying)
						return obj.ctx.currentTime - asset.startedAt + asset.offset;
					else
						return asset.offset;
				};
				asset.setOffset = function(offset){
					if (asset.isPlaying){
						asset.forceStop = true;
						asset.pause();
						asset.offset = offset;
						asset.play();
						setTimeout(() => asset.forceStop = false, 100);

					} else {
						asset.offset = offset;
					}
				};

			}// end buffer function
			, function (error){
				console.error('AudioContextPlayer.ctx.decodeAudioData error', error);
				asset.play = () => Promise.reject(error);

		}) // end obj.ctx.decodeAudioData function
	};

	return obj;
})();
