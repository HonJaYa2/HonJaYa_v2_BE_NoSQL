import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema({
    msg: { type: String, required: true },
    sender: { type: String, required: true },
    senderId: { type: String, required: true },
    senderProfile: { type: String, required: true },
    createAt: { type: Date, default: Date.now() },
  });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

export default ChatMessage;