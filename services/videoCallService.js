import { Server } from 'socket.io';

class VideoCallService {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: ["http://localhost:5173", "http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.connectedUsers = new Map(); // userId -> socketId mapping
    this.activeCallRooms = new Map(); // appointmentId -> { doctorId, patientId, status }
    
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 User connected: ${socket.id}`);

      // User registration
      socket.on('register-user', (userData) => {
        const { userId, userType } = userData;
        console.log(`👤 User registered: ${userId} as ${userType}`);
        
        this.connectedUsers.set(userId, {
          socketId: socket.id,
          userType,
          isAvailable: true
        });
        
        socket.userId = userId;
        socket.userType = userType;
      });

      // Doctor initiates video call
      socket.on('initiate-video-call', (data) => {
        const { appointmentId, patientId, doctorId } = data;
        console.log(`📞 Doctor ${doctorId} initiating call to patient ${patientId} for appointment ${appointmentId}`);
        console.log(`👥 Connected users:`, Array.from(this.connectedUsers.entries()));
        console.log(`🔍 Looking for patient with ID: ${patientId}`);

        const patientSocket = this.connectedUsers.get(patientId);
        
        if (patientSocket && patientSocket.isAvailable) {
          // Create call room
          this.activeCallRooms.set(appointmentId, {
            doctorId,
            patientId,
            status: 'calling'
          });

          // Send call alert to patient
          this.io.to(patientSocket.socketId).emit('incoming-video-call', {
            appointmentId,
            doctorId,
            doctorName: data.doctorName || 'Doctor'
          });

          // Notify doctor that call is being initiated
          socket.emit('call-initiated', {
            appointmentId,
            patientId,
            status: 'calling'
          });
        } else {
          // Patient not available
          socket.emit('call-failed', {
            appointmentId,
            reason: 'Patient not available'
          });
        }
      });

      // Patient responds to video call
      socket.on('respond-to-call', (data) => {
        const { appointmentId, response } = data; // response: 'accept' or 'decline'
        const callRoom = this.activeCallRooms.get(appointmentId);
        
        if (!callRoom) {
          socket.emit('call-error', { message: 'Call not found' });
          return;
        }

        const doctorSocket = this.connectedUsers.get(callRoom.doctorId);
        
        if (response === 'accept') {
          console.log(`✅ Patient accepted call for appointment ${appointmentId}`);
          
          // Update call status
          callRoom.status = 'accepted';
          
          // Create room for WebRTC signaling
          const roomName = `call-${appointmentId}`;
          socket.join(roomName);
          
          if (doctorSocket) {
            this.io.sockets.sockets.get(doctorSocket.socketId)?.join(roomName);
          }

          // Notify both parties to start WebRTC
          this.io.to(roomName).emit('call-accepted', {
            appointmentId,
            roomName
          });
          
        } else {
          console.log(`❌ Patient declined call for appointment ${appointmentId}`);
          
          // Remove call room
          this.activeCallRooms.delete(appointmentId);
          
          // Notify doctor of rejection
          if (doctorSocket) {
            this.io.to(doctorSocket.socketId).emit('call-declined', {
              appointmentId
            });
          }
        }
      });

      // WebRTC signaling
      socket.on('webrtc-offer', (data) => {
        const { appointmentId, offer } = data;
        socket.to(`call-${appointmentId}`).emit('webrtc-offer', { offer });
      });

      socket.on('webrtc-answer', (data) => {
        const { appointmentId, answer } = data;
        socket.to(`call-${appointmentId}`).emit('webrtc-answer', { answer });
      });

      socket.on('webrtc-ice-candidate', (data) => {
        const { appointmentId, candidate } = data;
        socket.to(`call-${appointmentId}`).emit('webrtc-ice-candidate', { candidate });
      });

      // End call
      socket.on('end-call', (data) => {
        const { appointmentId } = data;
        console.log(`📴 Call ended for appointment ${appointmentId}`);
        
        const roomName = `call-${appointmentId}`;
        
        // Notify all in room that call ended
        this.io.to(roomName).emit('call-ended', { appointmentId });
        
        // Remove users from room
        this.io.in(roomName).socketsLeave(roomName);
        
        // Remove active call room
        this.activeCallRooms.delete(appointmentId);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`🔌 User disconnected: ${socket.id}`);
        
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
          
          // Check if user was in any active calls and end them
          for (const [appointmentId, callRoom] of this.activeCallRooms.entries()) {
            if (callRoom.doctorId === socket.userId || callRoom.patientId === socket.userId) {
              this.io.to(`call-${appointmentId}`).emit('call-ended', { 
                appointmentId,
                reason: 'User disconnected'
              });
              this.activeCallRooms.delete(appointmentId);
            }
          }
        }
      });
    });
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Get active calls count
  getActiveCallsCount() {
    return this.activeCallRooms.size;
  }
}

export default VideoCallService;