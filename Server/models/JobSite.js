import mongoose from "mongoose";

const JobSiteSchema = new mongoose.Schema(

   {
     jobName: {
        type:String,
        trim: true,
        required: true
     },
     jobNumber: {
        type: String,
        trim:true,
        required: true
     },
     location: {
        type:String,
        default: "",
        trim:true
     },
     
     status: {
        type:String,
        enum: ["pending", "active", "rejected"],
        default: "active"
     },
     
     requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref:"User"
     },
      
   },
   {timestamps: true}

)
export default mongoose.model("JobSite", JobSiteSchema);