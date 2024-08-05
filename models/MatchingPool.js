import mongoose from "mongoose";
// import User from "./User";

const MatchingPoolSchema = new mongoose.Schema(
  {
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { collection: "matchingpool" }
); 

const MatchingPool = mongoose.model("MatchingPool", MatchingPoolSchema);

export default MatchingPool;
