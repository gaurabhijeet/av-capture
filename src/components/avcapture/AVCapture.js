import React, { Component } from 'react';
import { AppBar, Box, Button, Container, Grid, TextField, Toolbar, Typography } from '@material-ui/core';
import AdjustRoundedIcon from '@material-ui/icons/AdjustRounded';
import { fetchPermissions, getSupportedMimeType } from './utils/browser';
import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";
import './AVCapture.scss';

class AVCapture extends Component {

  constructor(props) {
    super(props);

    this.videoElemRef = React.createRef();
    this.downloadVideoAnchorRef = React.createRef();
    this.downloadAudioAnchorRef = React.createRef();
    this.canvasRef = React.createRef();
    this.mediaRecorder = null;
    this.speechRecognition = null;

    this.state = {
      constraints: {
        audio: {
          echoCancellation: { exact: true }
        },
        video: {
          //width: window.screen.width,
          // height: window.screen.height
        }
      },
      cameraPermission: '',
      microPhonePermission: '',
      checkingForPermissions: true,
      askForPermissions: true,
      permissionsDenied: false,
      recording: false,
      videoContent: [],
      supportedMimetype: '',
      audioTranscript: '',
      lastTranscript: ''
    };
  }

  componentDidMount() {
    this.checkForPermissions(true);
  }

  startRecording = () => {
    this.setState(() => { return { recording: true, audioTranscript: '' } });
    this.fetchFeedFromCamera();
    this.startAudioTranscription();
    this.loadTfBlazeFace();
  }

  loadTfBlazeFace = async () => {
    const tfBlazeFaceModel = await blazeface.load();
    setInterval(() => {
      this.detectFace(tfBlazeFaceModel);
    }, 1000);
  }

  detectFace = async (tfBlazeFaceModel) => {
    if (typeof this.videoElemRef.current !== "undefined" &&
      this.videoElemRef.current !== null &&
      this.videoElemRef.current.readyState === 4) {

      const videoWidth = this.videoElemRef.current.videoWidth;
      const videoHeight = this.videoElemRef.current.videoHeight;

      this.videoElemRef.current.width = videoWidth;
      this.videoElemRef.current.height = videoHeight;

      this.canvasRef.current.width = videoWidth;
      this.canvasRef.current.height = videoHeight;

      const predictions = await tfBlazeFaceModel.estimateFaces(this.videoElemRef.current, false);
      this.drawPolygon(predictions);

    }
  };

  drawPolygon = (tfBlazeFacePredictions) => {

    if (tfBlazeFacePredictions.length > 0 && this.canvasRef && this.canvasRef.current) {
      const ctx = this.canvasRef.current.getContext("2d");

      for (let i = 0; i < tfBlazeFacePredictions.length; i++) {
        const start = tfBlazeFacePredictions[i].topLeft;
        const end = tfBlazeFacePredictions[i].bottomRight;

        var probability = tfBlazeFacePredictions[i].probability;
        const size = [end[0] - start[0], end[1] - start[1]];

        ctx.beginPath();
        ctx.strokeStyle = "green";
        ctx.lineWidth = "4";
        ctx.rect(start[0], start[1], size[0], size[1]);
        ctx.stroke();
        var prob = (probability[0] * 100).toPrecision(5).toString();
        var text = prob + "%";
        ctx.fillStyle = "red";
        ctx.font = "13pt sans-serif";
        ctx.fillText(text, start[0] + 5, start[1] + 20);
      }
    }
  };

  checkForPermissions = (addEventListener) => {
    const microphoneGrantPromise = fetchPermissions('microphone');
    const cameraGrantPromise = fetchPermissions('camera');

    Promise.all([cameraGrantPromise, microphoneGrantPromise]).then((response) => {
      const microphonePermission = response[0];
      const cameraPermission = response[1];

      if (addEventListener) {
        this.addEventListeners(microphonePermission, cameraPermission);
      }

      const permissionsGranted = microphonePermission.state === 'granted' && cameraPermission.state === 'granted';
      const permissionsDenied = microphonePermission.state === 'denied' && cameraPermission.state === 'denied';
      this.setState(() => {
        return {
          cameraPermission: cameraPermission.state,
          microPhonePermission: microphonePermission.state,
          askForPermissions: !permissionsGranted,
          permissionsDenied: permissionsDenied
        }
      });
    });
  };

  addEventListeners = (microphonePermission, cameraPermission) => {
    microphonePermission.addEventListener('change', (event) => {
      fetchPermissions('camera').then((permission) => {
        const cameraPermissionState = permission.state;
        const permissionsGranted = event.target.state === 'granted' && cameraPermissionState === 'granted';
        this.setState(() => {
          return {
            microPhonePermission: event.target.state,
            askForPermissions: !permissionsGranted
          }
        });
      });

    });

    cameraPermission.addEventListener('change', (event) => {
      fetchPermissions('camera').then((permission) => {
        const microPhonePermissionState = permission.state;
        const permissionsGranted = microPhonePermissionState === 'granted' && event.target.state === 'granted';
        this.setState(() => {
          return {
            cameraPermission: event.target.state,
            askForPermissions: !permissionsGranted
          }
        });
      });

    });
  }

  askForPermissions = () => {
    navigator.mediaDevices.getUserMedia(this.state.constraints);
    this.checkForPermissions(false);
  }

  fetchFeedFromCamera = () => {
    try {
      if (!this.state.askForPermissions) {
        navigator.mediaDevices.getUserMedia(this.state.constraints)
          .then((stream) => {
            this.handleVideoStream(stream);
          })
          .catch(function (error) {
            console.log(error.message);
          });;

      }

    } catch (error) {
      console.error(error);
      alert('Error occured' + error.message);
    }
  }

  handleVideoStream = (stream) => {
    const supportedMimetype = getSupportedMimeType();

    if (!supportedMimetype) {
      alert('No supported video type available.')
      return;
    }

    this.setState(() => { return { supportedMimetype: supportedMimetype } });

    try {
      var options = {
        audioBitsPerSecond: 128000,
        videoBitsPerSecond: 2500000,
        mimeType: supportedMimetype
      }

      this.mediaRecorder = new MediaRecorder(stream, options);

      this.mediaRecorder.onstop = (event) => {
        console.log('Recorder stopped: ', event);
        setTimeout(() => {
          stream.getTracks().forEach(track => track.stop());
          this.downloadVideoRecording();
          this.downloadAudioTranscript();
        }, 1000);
      };

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          let recordedVideoContent = this.state.videoContent;
          recordedVideoContent.push(event.data);
          this.setState(() => { return { videoContent: recordedVideoContent } });
        }
      };

      this.mediaRecorder.start();

      this.videoElemRef.current.srcObject = stream;

    } catch (error) {
      console.error(error);
      alert('Error occured' + error.message);
    }

  }

  stopRecording = () => {
    if (this.mediaRecorder && this.speechRecognition) {
      this.mediaRecorder.stop();
      this.speechRecognition.stop();
      this.setState(() => { return { recording: false } });
    }
  }

  downloadVideoRecording = () => {
    const videoBlob = new Blob(this.state.videoContent, { type: this.state.supportedMimetype });
    const url = window.URL.createObjectURL(videoBlob);

    const anchorElem = this.downloadVideoAnchorRef.current;
    anchorElem.href = url;
    anchorElem.download = window.performance.now().toString().replace(/\./g, '') + '.mp4';
    anchorElem.click();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 100);
  }

  startAudioTranscription = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.speechRecognition = new SpeechRecognition();
    this.speechRecognition.continuous = true;
    this.speechRecognition.interimResults = true;

    this.speechRecognition.onstart = () => {
      console.log('web speech api started');
    };

    this.speechRecognition.onerror = (event) => {
      console.log('web speech api errored out');
      console.log(event);
    };

    this.speechRecognition.onspeechend = () => {
      console.log('web speech api stopped');

      if (this.state.recording) {
        this.startAudioTranscription();
      }
    };

    this.speechRecognition.onresult = (event) => {
      const interimTranscript = event.results[0][0].transcript;
      if (interimTranscript !== this.state.lastTranscript) {
        let audioTranscript = this.state.audioTranscript;
        audioTranscript += interimTranscript;
        this.setState(() => { return { audioTranscript: audioTranscript, lastTranscript: interimTranscript } });
      }
    };

    this.speechRecognition.start();
  }

  downloadAudioTranscript = () => {
    const audioTranscriptBlob = new Blob([this.state.audioTranscript], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(audioTranscriptBlob);

    const anchorElem = this.downloadAudioAnchorRef.current;
    anchorElem.href = url;
    anchorElem.download = window.performance.now().toString().replace(/\./g, '') + '.txt';
    anchorElem.click();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 100);
  }

  render() {
    return (
      <React.Fragment>
        <AppBar position="relative">
          <Toolbar>
            <Typography variant="h6" color="inherit" noWrap>
              Audio - Video capture
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth='xl'>
          <Box my={4}>
            <Grid container
              direction='row'
              spacing={3}
              alignItems="center"
              justify="center">

              {this.state.permissionsDenied &&
                <Grid item xs={12} className="text-center">
                  <h4>Camera and microphone access is denied for the app</h4>
                </Grid>
              }

              {(!this.state.permissionsDenied && this.state.askForPermissions) &&
                <Grid item xs={12} className="text-center">
                  <Button variant="contained" color="primary" onClick={this.askForPermissions}>
                    Ask for Camera and Microphone permissions
                  </Button>
                </Grid>
              }

              {(!this.state.permissionsDenied && !this.state.askForPermissions && !this.state.recording) &&
                <Grid item xs={12} className="text-center">
                  <Button variant="contained" color="primary" onClick={this.startRecording}>
                    Start
                </Button>
                </Grid>
              }

              {(!this.state.permissionsDenied && !this.state.askForPermissions && this.state.recording) &&
                <React.Fragment>
                  <Grid item xs={12} className="text-center">
                    <Button variant="contained" color="secondary" onClick={this.stopRecording}>
                      Stop
                    </Button>
                    <AdjustRoundedIcon className="blink" />
                  </Grid>
                  <Grid item xs={6} className="text-center">
                    <div id="av-components">
                      <video id="av-video" className="mirror" ref={this.videoElemRef} playsInline autoPlay muted></video>
                      <canvas id="av-canvas" className="mirror" ref={this.canvasRef}></canvas>
                    </div>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="h6" color="inherit" noWrap>
                      Audio transcription
                    </Typography>
                    <TextField
                      id="standard-textarea"
                      variant="outlined"
                      multiline
                      InputProps={{
                        readOnly: true
                      }}
                      rows={30}
                      fullWidth={true}
                      value={this.state.audioTranscript}
                    />
                  </Grid>
                </React.Fragment>
              }
            </Grid>
            <a className="hide" href="google.com" ref={this.downloadVideoAnchorRef}>download</a>
            <a className="hide" href="google.com" ref={this.downloadAudioAnchorRef}>download</a>
          </Box>
        </Container>
      </React.Fragment>
    )
  }
}

export default AVCapture;
