const { Storage } = require('@google-cloud/storage')
const express = require('express')
const bodyParser = require('body-parser')
require('dotenv').config()

const app = express()
app.use(bodyParser.json())
const port = 3000

const storage = new Storage()

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'POST, GET')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return next()
})




app.post('/bucket/:bucketName/signed-url/download', async (req, res) => {
    let body = req.body
    if (!('fileName' in body)) {
        res.status(400)
        return res.send({
            status: 400,
            message: 'fileName missing.'
        })
    }

    try {
        const url = await getDownloadSignedURL(body.fileName, req.params.bucketName)
        return res.send({
            status: 200,
            url: url
        })

    } catch (error) {
        res.status(500)
        return res.send({
            status: 500,
            error: error
        })
    }


})

app.post('/bucket/:bucketName/signed-url/upload', async (req, res) => {
    let body = req.body
    if (!('fileName' in body)) {
        res.status(400)
        return res.send({
            status: 400,
            message: 'fileName missing.'
        })
    }

    if (!('fileType' in body)) {
        res.status(400)
        return res.send({
            status: 400,
            message: 'fileType missing.'
        })
    }


    try {
        const url = await getUploadSignedURL(body.fileName, body.fileType, req.params.bucketName)
        return res.send({
            status: 200,
            url: url
        })
    } catch (error) {
        res.status(500)
        return res.send({
            status: 500,
            error: error
        })
    }

})

app.get('/bucket/:bucketName/images', async (req, res) => {
    let files = await getListImages(req.params.bucketName)
    let filesList = []
    for (let i = 0; i < files.length; i++) {
        let signedUrl = await getDownloadSignedURL(files[i].metadata.name, req.params.bucketName)
        filesList.push({
            name: files[i].metadata.name,
            updated: files[i].metadata.updated,
            size: files[i].metadata.size,
            url: signedUrl
        })
    }

    return res.send({
        status: 200,
        data: filesList
    })
})

app.post('/bucket/:bucketName/cors', async (req, res) => {
    if (!('origin' in req.body)) {
        res.status(400)
        return res.send({
            status: 400,
            message: 'origin missing.'
        })
    }

    try {
        await configureBucketCors(req.params.bucketName, req.body.origin)
        return res.send({
            status: 200,
            message: 'done'
        })

    } catch (error) {
        res.status(500)
        return res.send({
            status: 500,
            message: error
        })
    }


})

app.post('/bucket', async (req, res) => {
    if (!('bucketName' in req.body)) {
        res.status(400)
        return res.send({
            status: 400,
            message: 'bucketName missing'
        })
    }

    try {
        const [bucket] = await storage.createBucket(req.body.bucketName, {
            location: 'ASIA'
        })

        return res.send({
            status: 200,
            data: bucket
        })

    } catch (error) {

        res.status(500)
        return res.send({
            status: 500,
            message: error
        })
    }

})

app.get('/bucket', async (req, res) => {
    const [buckets] = await storage.getBuckets();

    return res.send({
        status: 200,
        data: buckets.map(b => b.name)
    })
})

app.get('/bucket/:bucketName/cors', async (req, res) => {
    const [acls] = await storage.bucket(req.params.bucketName).acl.get();
    return res.send({
        status: 200,
        data: acls
    })

})


async function getDownloadSignedURL(fileName, bucketName) {
    // These options will allow temporary read access to the file
    const options = {
        version: 'v4',
        action: 'read',
        expires: Date.now() + 1 * 60 * 1000, // 1 minutes
    };

    // Get a v4 signed URL for reading the file
    const [url] = await storage
        .bucket(bucketName)
        .file(fileName)
        .getSignedUrl(options);
    // console.log(`curl '${url}'`);
    return url
}


async function getUploadSignedURL(fileName, fileType, bucketName) {
    const options = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 30 minutes
        contentType: fileType,
    };
    const [url] = await storage
        .bucket(bucketName)
        .file(fileName)
        .getSignedUrl(options);

    // console.log(
    //     "curl -X PUT -H 'Content-Type: image/jpeg' " +
    //     `--upload-file ${fileName} '${url}'`
    // );

    return url
}

async function configureBucketCors(bucketName, origin) {
    await storage.bucket(bucketName).setCorsConfiguration([
        {
            maxAgeSeconds: 3600,
            method: ['GET', 'PUT'],
            origin: [origin],
            responseHeader: ['Content-Type'],
        },
    ]);

    console.log(`Bucket ${bucketName} was updated with a CORS config
        to allow ${['GET', 'PUT']} requests from ${origin} sharing 
        ${'Content-Type'} responses across origins`);
}

async function getListImages(bucketName) {
    const [files] = await storage.bucket(bucketName).getFiles();
    return files
}


app.get('/', (req, res) => {
    return res.send({
        message: 'server running...'
    })
})

app.listen(port, () => {
    console.log(`running on port ${port}`)
})
