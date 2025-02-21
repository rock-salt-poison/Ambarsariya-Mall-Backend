const { processDrive } = require("./GoogleDriveAccess/Drive");

const post_openFile = async (req, res) => {
    console.log(req.params);
    const { email } = req.params;
    
    try{
      if (!email) return res.status(400).json({ success: false, message: "Email is required" });

      const response = await processDrive(email);
      res.json(response);
    }catch(e){
      console.log('Email : ', e);
    }
    } 


module.exports = {
    post_openFile
}
