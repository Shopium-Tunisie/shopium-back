const Fabricant = require('../model/fabricant')
const OfferModel = require('../model/offresModel')
const ProductModel = require('../model/ProductModel')
const Products = require('../model/ProductModel')
const SubCategory = require('../model/subCategory')
const { updateCategory } = require('./category')
 
const productCtrl = {
    getProducts: async(req, res) =>{
        try {
            const products = await Products.find() 
            res.json(
                 products
            )
            
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    createProduct: async(req, res) =>{
        try {
            let offer='';
            const { name, price ,barcode ,categoryId,fabricant,photo} = req.body;
            console.log(req.body)
            console.log({categoryId});
            const categories = await SubCategory.findOne({categoryId});
            console.log({'categories':categories});
            if(!categories) return res.send({success:false,msg:'category not found ! '});
            const product = await Products.findOne({name:name})
            if(product)
                return res.status(400).json({msg: "This product already exists."})
            const fab = await Fabricant.findById(fabricant);
            console.log(fab.logo)
            const newProduct = new Products({
                name: name.toLowerCase(),
                price,
                barcode,
                photo,
                categoryId,
                fabricant,
                logo:fab.logo,
                offer:offer, 
                isLiked:false,
                isnew:false, 
            });

            await newProduct.save();
            //////////////////////////////// relation one To Many
            await SubCategory.updateMany({'id':newProduct.categoryId},{$push:{products:newProduct._id}})
            ///////////////////////////////
            await Fabricant.updateMany({'id':newProduct.fabricant},{$push:{products:newProduct._id}})
            res.json({success:true,msg: "Created a product",data:newProduct})

        } catch (err) {
            console.log(err);
            return res.status(500).json({msg: err.message})
            
        }
    },
    deleteProduct: async(req, res) =>{
        try {
            await Products.findByIdAndDelete(req.body.id)
            res.json({msg: "Deleted a Product"})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    updateProduct: async(req, res) =>{
        try {
            const { name, price  , category} = req.body;
 
            await Products.findOneAndUpdate({_id: req.params.id}, {
                name: name.toLowerCase(), price, category
            })

            res.json({msg: "Updated a Product"})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },

    getFabricantByProduct:async(req,res)=>{
        const id= req.body.id;
        console.log({id});  
        const product = await ProductModel.findById({_id:id});
        // res.send(product);
        console.log ({product});
        const fabricant = await Fabricant.findById({_id:product.fabricant})
        console.log(fabricant)
        res.send(fabricant)
    },

    getOfferByProduct:async(req,res)=>{
        try {
            const id=req.body.id;
            console.log(id);
            const product = await ProductModel.findById({_id:id});
            // res.send(product);
            console.log ({product});
            const offer = await OfferModel.findById(product.offer)
            return res.json(offer);
            
        } catch (error) {
            console.log(error);
        }
    },


    getProductByCategory:async(req,res)=>{
        try {
            const _id= req.body.id;
            console.log({id:_id});
    const product = await ProductModel.findById(_id);
            if(!product)
            {
                return res.status(404).json({message:"failed"});
            }
            else
            {
                const productList = await ProductModel.find({categoryId:product.categoryId})
                return res.status(200).json({data:productList});

            }
    } catch (error) {
            console.log(error);
            return res.status(500).json(error)
        }
    }
    
}



module.exports = productCtrl