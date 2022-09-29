const User = require("../model/user");
const {sendError, createRandomBytes} = require("../utils/helper");
const jwt = require("jsonwebtoken");
const {generateOTP, transporter} = require("../utils/mail");
const VerificationToken = require("../model/verificationToken");
const {isValidObjectId} = require("mongoose");
const ResetToken = require("../model/resetToken");
const crypto = require("crypto");
const multer = require("multer");
const image = "/images/user/photo_1652707413348_farouk.jpg";
const referralCodes = require("referral-codes");
const ProductModel = require("../model/ProductModel");
const Offer  = require('../model/offresModel');
const Category = require('../model/category');
const offresModel = require("../model/offresModel");



exports.createUSer = async (req, res) => {
  try {
    const {
      nom,
      prenom,
      ville,
      pays,
      email,
      password,
      date,
      genre
    } = req.body;
    const user = await User.findOne({email});
    console.log({user});
    if (user) {
      return res.status(404).json({res: "email existe déja !"});
    }
    const token = jwt.sign({
      userId: Math.random(10)
    }, process.env.JWT_SECURE, {expiresIn: "1d"});

    const code = referralCodes.generate({count: 1, length: 6, charset: "0123456789"});
    let codepar = code[0];

    const newUser = new User({
      nom,
      prenom,
      ville,
      pays,
      email,
      password,
      role: "subscriber",
      photo: "https://res.cloudinary.com/frouga/image/upload/v1659959078/profile_bkurim.png",
      cloudinary_id: "",
      codeParrainage: codepar,
      date,
      genre,
    });
    const OTP = generateOTP();
    console.log(OTP);
    const verificationToken = new VerificationToken({owner: newUser._id, token: OTP});
    await verificationToken.save();
    await newUser.save();
    console.log({newUser});
    const msg = {
      from: "appshopium@gmail.com", // sender address
      to: newUser.email, // list of receivers
      subject: "Verify your account ✔", // Subject line
      text: "Hello world?", // plain text body
      html: `<h1>${OTP}</h1>` // html body
    };
    await transporter.sendMail(msg);

    res.send({
      success: true,
      user: {
        nom: newUser.nom,
        email: newUser.email,
        id: newUser._id,
        verified: newUser.verified,
        ville: newUser.ville,
        pays: newUser.pays,
        photo: newUser.photo,
        codeParrainage: code,
        date: date,
        genre: genre,
      }
    });
  } catch (error) {
    console.log(error);
  }
};

exports.signin = async (req, res) => {
  try {
    const {email, password} = req.body;
    if (!email.trim() || !password.trim()) {
      return res.status(500).json({msessage: "email/password missing!"});
    }
    const user = await User.findOne({email});
    console.log(user.verified);
    if (!user) {
      return res.status(404).json({msessage: "USer NOt found"});
    }
    const isMatched = await user.comparePassword(password);
    if (!isMatched) {
      return res.status(404).json({msessage: "USer NOt found"});
    }
    if (user.verified === "false") {
      return res.status(400).json({msessage: "please Verifed your account"});
    }
    const token = jwt.sign({
      user: user
    }, process.env.JWT_SECURE, {expiresIn: "1d"});

    res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        id: user._id,
        verified: user.verified,
        dateNaissance: user.date,
        genre: user.genre,
        token,
        photo: user.photo,
        reviewsCount: user.reviewsCount
      },
      id: user._id,
      verified: user.verified,
      token
    });
  } catch (error) {
    return res.status(500).json({msessage: error});
  }
};

exports.verifyEmail = async (req, res) => {
  const userId = req.body.userId;
  const otp = req.body.otp;
  console.log(userId);
  console.log(otp);
  if (!userId || !otp.trim()) 
    return sendError(res, "Invalid request ,missing parameters");
  if (!isValidObjectId(userId)) 
    return sendError(res, "Invalid user ID ! ");
  
  const user = await User.findById(userId);
  if (!user) 
    return sendError(res, "Sorry,user not Found !");
  
  if (user.verified) 
    return sendError(res, "This account is already verified!");
  const token = await VerificationToken.findOne({owner: user._id});
  if (!token) 
    return sendError(res, "Sorry, user not found!");
  
  const isMatched = await token.compareToken(otp);
  if (!isMatched) 
    return sendError(res, "Please provide a valid token!");
  user.verified = true;
  await VerificationToken.findByIdAndDelete(token._id);
  await user.save();
  const msg = {
    from: "appshopium@gmail.com", // sender address
    to: user.email, // list of receivers
    subject: "Email Verified Successfully ✔", // Subject line
    html: `<h1>Thanks for connecting with us</h1>` // html body
  };
  await transporter.sendMail(msg);
  res.json({
    success: true,
    message: "your email is verified.",
    user: {
      nom: user.nom,
      email: user.email,
      id: user._id
    },
    token: user.token
  });
};
exports.forgotPassword = async (req, res) => {
  const {email} = req.body;
  if (!email) 
    return sendError(res, "Please provide a valid email!");
  const user = await User.findOne({email});
  if (!user) 
    return sendError(res, "User not found, invalid request!");
  let token = await ResetToken.findOne({owner: user._id});
  if (!token) {
    token = await new ResetToken({owner: user._id, token: crypto.randomBytes(32).toString("hex")}).save();
    console.log(token.token);
    const msg = {
      from: "appshopium@gmail.com", // sender address
      to: user.email, // list of receivers
      subject: "Password Reset", // Subject line
      html: `http://localhost:8000/reset-password?token=${token.token}&id=${user._id}` // html body
    };
    await transporter.sendMail(msg);
    res.json({success: true, message: "Password reset Link is sent to your email", token: token.token, id: user._id});
  } else {
    return sendError(res, "Only after one hour you can request for another token");
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const id = req.body.id,
      nom = req.body.nom,
      prenom = req.body.prenom,
      ville = req.body.ville,
      pays = req.body.pays,
      photo=req.body.photo;
    console.log(req.body.id);
    console.log(req.body.nom);
    console.log(req.body.prenom);
    console.log(req.body.ville);
    console.log(req.body.pays);
    console.log(photo)
    const CurrentUser = await User.findOne({id});
    if (!CurrentUser) {
      return res.status(404).json({success: false, message: "User n existe pas"});
    } else {
      const UserModifier = await User.findByIdAndUpdate(id, {
        nom: nom,
        prenom: prenom,
        ville: ville,
        pays: pays,
        photo:photo
      });
      return await res.status(200).json({success: true, message: "update success for user", data: UserModifier});
    }
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({msg: "server error", message: error});
  }
};

exports.getAmi = async (req, res) => {
  try {
    const id = req.body.id;
    console.log(id);
    const data = await User.findById(id);
    console.log({data});
    if (!data) {
      res.status(404).json({success: false, message: "User not found !!"});
    }
    // user.ami.forEach(element=>console.log(element.prenom));

    res.status(200).json({success: false, message: "Success", data: data.ami});
  } catch (error) {
    res.status(500).json({success: true, message: "success", error: error});
  }
};

//////wishList add/get/delete
exports.addToWish = async (req, res) => {
  try {
    const productId = req.body.productId;
    const id = req.body.id;
    const product = await ProductModel.findById(productId);
    const category = await Category.findById(product.categoryId)
    const offer = await Offer.findById(product.offer);
const userCheckWishList = await User.findById(id);
console.log(userCheckWishList.wishlist);
console.log({offerId:offer._id})
const wish=userCheckWishList.wishlist.filter(elem=>elem.offerId.includes(offer._id.toString()))
console.log({wish:wish})
console.log({wish:wish.toString()})
  if( wish.includes(false)||wish==undefined||wish.toString()==''){
    const user = await User.findOneAndUpdate({
      _id: id
    }, {
      $addToSet: {wishlist:{
        offerId:offer._id,
        productName:product.name,
        photo : product.photo[0], 
        avgReviews :offer.avgReviews,
        categoryName:category.name,
        views:offer.views,
        dateCreation:offer.startDate,
        isLiked:"red",
        
      }}
    }).exec();
    console.log(user);
    return res.status(200).json({ok: true, user: user,color:"red"});
  }else{  
    console.log(wish)
    return res.status(201).json({message:"deja exist"})
  }
  } catch (error) {
    console.log(error);
    res.status(500).json({error: error});
  }
};

exports.getWishlist = async (req, res) => {
  const id = req.body.id;
  const list = await User.findOne({_id: id}).select("wishlist").populate("wishlist").exec();

  res.json(list);
};

exports.removeWishlist = async (req, res) => {
  try {
    
    const offerIdRemoved = req.body.offerId;
    console.log(offerIdRemoved)
    const prod =await ProductModel.findById(offerIdRemoved);
    console.log({prod})
    const offer = prod.offer
    console.log({offer:offer.toString()})
    const id = req.body.id;
    const user = await User.findById(id);
    if(user){
      //Call the findIndex() method to get the index of the object in the array.
     const itemRemove= user.wishlist.findIndex(item=>{
      console.log({offerId:item.offerId})
      console.log({offer})
      return item.offerId === offer.toString();
    });  
        console.log({itemRemove})
        //Use the splice() method to remove the element at that index, the splice method changes the contents of the array by removing or replacing existing elements
        user.wishlist.splice(itemRemove,1);
      await user.save()
    return  res.status(200).json({ok: true, user: user,color:"grey"});
    }
  
  } catch (error) {
    console.log({error})
   return res.status(500).json({error});
  }

};

exports.likedOffer = async(req,res)=>{
  try {
       let cheked 
    const productId = req.body.productId;
    const id = req.body.userId
    const product = await ProductModel.findById(productId);
    const offer = await Offer.findById(product.offer);
    const user = await User.findById(id);
    if(user)
    {
     const check= user.wishlist.filter((elem)=>elem.isLiked==="red");
      cheked = check;
     console.log({check})
      if(check===true){
        res.json({liked:true,color:'red'});
      }else{
        res.json({liked:false,color:'grey'})
      }
    }else{
      res.json(cheked)
    }
  } catch (error) {
      console.log(error)
      res.status(500).json({error:error})
  }
  }
