import mongoose from "mongoose";

const ChattingRoomSchema = new mongoose.Schema({
    roomNum: {type: Number, required: true, unique: true},
    messageHistory: [{type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage'}]
});

const ChattingRoom = mongoose.model("ChatRoom", ChattingRoomSchema);

export default ChattingRoom