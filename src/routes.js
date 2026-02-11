const express = require('express');
const router = express.Router();
const AuthController = require('./controllers/AuthController');
const CompanyController = require('./controllers/CompanyController');

// Health Check
router.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Back-End ABM Agro is running' });
});

//Login
router.get('/verifyToken', AuthController.validateTokenByQuery);
router.post('/verifyLogin', AuthController.verifyLogin);

//SSO Authentication
router.post('/auth/sso-validate', AuthController.validateSSO);

//CRUD (Protected)
router.get('/getUsers', AuthController.getUsers);
router.post('/createUser', AuthController.createUser);
router.put('/updateUser', AuthController.updateUser);
router.delete('/deleteUser', AuthController.deleteUser);

//Filters
router.get('/getCnaes', CompanyController.getCnaes);
router.post('/getAllIdsFilter', CompanyController.getAllIdsFilter);
router.post('/getItemsByIds', CompanyController.getItemsByIds);
router.get('/debug/cnaes', CompanyController.debugCnaes);

//Adsets
router.get('/getAccounts', CompanyController.getContas);
router.get('/getCampaigns', CompanyController.getCampaigns);
router.post('/createAdset', CompanyController.createAdset);
router.post('/savePublic', CompanyController.savePublic);

module.exports = router;