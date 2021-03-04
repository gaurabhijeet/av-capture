import React, { Component } from 'react';
import { AppBar, Box, Button, Container, Grid, TextField, Toolbar, Typography } from '@material-ui/core';
import AdjustRoundedIcon from '@material-ui/icons/AdjustRounded';
import { fetchPermissions, getSupportedMimeType } from './utils';
import './AVCapture.scss';

class AVCapture extends Component {

  constructor(props) {
    super(props);

    this.videoElemRef = React.createRef();

    this.state = {
      constraints: {
        audio: {
          echoCancellation: { exact: true }
        },
        video: {
          width: 200, height: 200
        }
      },
      cameraPermission: '',
      microPhonePermission: '',
      checkingForPermissions: true,
      askForPermissions: true,
      permissionsDenied: false,
      recording: false,
      mediaRecorder: null,
      audioTranscript: '',
      videoContent: []
    };
  }

  componentDidMount() {
    this.checkForPermissions(true);
  }

  startRecording = () => {
    this.setState(() => { return { recording: true } });
    this.fetchFeedFromCamera();
  }

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
        debugger;
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

    try {
      var options = {
        audioBitsPerSecond: 128000,
        videoBitsPerSecond: 2500000,
        mimeType: supportedMimetype
      }

      const mediaRecorder = new MediaRecorder(stream, options);

      this.setState(() => { return { mediaRecorder: mediaRecorder } });

      mediaRecorder.onstop = (event) => {
        console.log('Recorder stopped: ', event);
      };
      mediaRecorder.ondataavailable = this.handleDataAvailable;
      mediaRecorder.start();

      this.videoElemRef.current.srcObject = stream;
    } catch (error) {
      console.error(error);
      alert('Error occured' + error.message);
    }

  }

  handleDataAvailable = (event) => {
    if (event.data && event.data.size > 0) {
      let recordedVideoContent = this.state.videoContent;
      recordedVideoContent.push(event.data);
      this.setState(() => { return { videoContent: recordedVideoContent } });
    }
  }

  stopRecording = () => {
    if (this.state.mediaRecorder) {
      this.state.mediaRecorder.stop();
      this.setState(() => { return { recording: false } });
      this.downloadVideoRecording();
    }
  }

  downloadVideoRecording = () => {

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
                  <Grid item xs={4}>
                    <Typography variant="h6" color="inherit" noWrap>
                      Video
                    </Typography>
                    <video className="mirror-video" ref={this.videoElemRef} playsInline autoPlay muted></video>
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
          </Box>
        </Container>
      </React.Fragment>
    )
  }
}

export default AVCapture;
