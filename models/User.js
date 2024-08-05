// const mongoose = require('mongoose');

import mongoose from 'mongoose';

const MathchedUser = new mongoose.Schema({
  userId: {type: String, required: true},
  matchedTime: {type: Number, required: true},
})

const idealType = new mongoose.Schema({
  maxAge: {type: Number, required: true},
  minAge: {type: Number, required: true},
  maxHeight: {type: Number, required: true},
  minHeight: {type: Number, required: true},
  maxWeight: {type: Number, required: true},
  minWeight: {type: Number, required: true},
  mbti: {type: String, required: true},
  religion: {type: String, required: true},
  drinkAmount: {type: String, required: true},
  smoke: {type: Boolean, required: true},
})

const UserSchema = new mongoose.Schema({
  // token: { type: String, required: true, unique: true },
  userId: { type: Number, required: true, unique: true},
  userName: { type: String, required: true },
  profileImage: { type: String, required: true },

  birthday: {type: Date},
  gender: {type: String},
  height: {type: Number},
  weight: {type: Number},
  mbti: {type: String},
  religion: {type: String},
  drinkAmount: {type: String},
  smoke: {type: Boolean},
  address: {type: String},

  idealType: {type: idealType},
  matchedUser: {type: [MathchedUser]},
});

const User = mongoose.model('User', UserSchema);

export default User;