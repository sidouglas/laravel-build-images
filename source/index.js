const sharp = require('sharp')
const path = require('path')
const fs = require('fs-extra')
const Promise = require('bluebird')
const yargs = require('yargs')
let execFile = require('child_process').execFile
execFile = Promise.promisify(execFile)
const validImages = ['.jpg', '.png', '.gif']

const IMAGE_DIR = yargs.argv.source
const OUTPUT_PATH = yargs.argv.destination
const SIZES = yargs.argv.images.split(',')
let userTest  = [IMAGE_DIR,OUTPUT_PATH];

userTest.map(inputPath => {
  fs.pathExistsSync(inputPath, err => err && process.exit());
});

/*
 * First wipe out the size directories in the
 * assets folder. This is synchronous.
 * */
 SIZES.map((folderSize) => {
  let folders = `${IMAGE_DIR}/${folderSize}`

  deleteFolderRecursive(folders)

  fs.mkdir(folders)
})

/*
 * iterate through all the images in the resource directory
 * and pluck out the images that match the validImages array
 * */
 execFile('find', [IMAGE_DIR]).then(function (stdout) {
  let images = []
  return new Promise(function (resolve) {
    let fileList = stdout.split('\n')
    images = fileList.filter(function (image) {
      let ext = path.extname(image)
      if (validImages.indexOf(ext) > -1) {
        return image
      }
    })
    return resolve(images)
  })
})
 .then(processImages)
 .then((images) => moveTo(images, OUTPUT_PATH))

/*
 * deleteFolderRecursive
 * the node way to do -rm -r
 * @param path:string to remove
 * */
 function deleteFolderRecursive (path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function (file, index) {
      let curPath = `${path}/${file}`;
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath)
      } else { // delete file
        fs.unlinkSync(curPath)
      }
    })
    fs.rmdirSync(path)
  }
}

/**
 * processImages
 * Iterate through the images and generate the variations
 * @param images:Array
 */
 function processImages (images) {

  let processImages = []
  let processCount = SIZES.length

  return new Promise(function (resolve) {
    images.map(function (image) {
      SIZES.map(function (width) {
        width = +width
        sharp(image)
        .resize(width, undefined, {
          kernel: sharp.kernel.lanczos2,
          interpolator: sharp.interpolator.nohalo
        })
        .toFile(`${IMAGE_DIR}/${width}/${path.basename(image)}`,(err,info) => {
          processImages.push(`${IMAGE_DIR}/${width}/${path.basename(image)}`)
          processCount--
          if(processCount === 0){
            resolve(processImages)
          }
        })
      })
    })
  })
}

/**
 * moveTo
 * Moves images to outputBaseFolder. Takes the same structure of folders.
 * @param images:Array<string> path of input files ( relative path )
 * @param outputBaseFolder:string (relative path)
 */
 function moveTo (images, outputBaseFolder) {

  const destination = function (pathDir) {
    return outputBaseFolder + '/' + pathDir.match(/(?!\/)[0-9]{1,}(?=\/).*/)[0]
  }

  images.map(function (imagePath) {
    let destinationPath = destination(imagePath)
    fs.ensureDir(path.dirname(destinationPath)).then(() => {
      console.log('created image and sent to' , imagePath, ' and then moved to ', destinationPath );
      fs.moveSync(imagePath, destinationPath, {overwrite: true})
    })
  })
}
