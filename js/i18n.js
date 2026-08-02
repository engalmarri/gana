const LANG_KEY = "sallah_lang";
const CAT_LABELS = {
  ar: {"قسم المعمل":"قسم المعمل","قسم السوبرماركت":"قسم السوبرماركت","قسم محلات الجملة":"محلات الجملة","قسم المستودع":"قسم المستودع","احتياجات المعمل":"احتياجات المعمل","الكل":"الكل","all":"جميع المنتجات"},
  en: {"قسم المعمل":"Lab","قسم السوبرماركت":"Supermarket","قسم محلات الجملة":"Wholesale","قسم المستودع":"Warehouse","احتياجات المعمل":"Lab Needs","الكل":"All","all":"All Products"}
};
const CAT_IMAGES = {
  "قسم المعمل":      { ar: "images/almamal-ar.png",       en: "images/almamal-en.png" },
  "قسم السوبرماركت": { ar: "images/supermarket-ar.png",   en: "images/supermarket-en.png" },
  "قسم محلات الجملة": { ar: "images/aljumllah-ar.png",    en: "images/aljumllah-en.png" },
  "قسم المستودع":    { ar: "images/almstodaa-ar.png",     en: "images/almstodaa-en.png" },
  "احتياجات المعمل":  { ar: "images/almamsuplesl-ar.png",  en: "images/almamsuplesl-en.png" }
};
const T = {
  ar: {
    searchPlaceholder: "🔍 ابحث عن منتج...",
    login: "🔑 دخول",
    loginTitle: "تسجيل الدخول",
    loginSubtitle: "اختر نوع الحساب والاسم وأدخل كلمة المرور",
    accountType: "-- نوع الحساب --",
    accountTypeLab: "جرد مخزون",
    accountTypeBranch: "حساب فرع",
    selectName: "-- اختر الاسم --",
    pinPlaceholder: "كلمة المرور",
    submit: "دخول",
    name: "الاسم:",
    type: "النوع:",
    show: "إظهار",
    hide: "إخفاء",
    changePin: "🔑 تغيير كلمة المرور",
    myInvoices: "📄 فواتيري",
    logout: "🚪 تسجيل الخروج",
    logoutConfirm: "هل تريد تسجيل الخروج؟",
    welcomeMsg: "مرحباً بك في سمسم",
    welcomeSub: "سجّل دخولك للوصول إلى المنتجات",
    loginBtnOverlay: "🔑 تسجيل الدخول",
    addedToCart: "تمت الإضافة",
    addToCart: "إضافة إلى السلة",
    noProducts: "لا توجد منتجات في هذا القسم",
    loading: "جاري تحميل المنتجات...",
    selectAccountType: "اختر نوع الحساب",
    selectNameErr: "اختر الاسم",
    pinFourDigits: "الرجاء إدخال كلمة المرور",
    enterPin: "الرجاء إدخال كلمة المرور",
    accountNotFound: "الحساب غير موجود",
    wrongPassword: "كلمة المرور خاطئة",
        inventoryAccountRequired: "هذا الحساب لا يمكنه الدخول لصفحة الجرد. استخدم حساب جرد مخزون.",
    invoiceNum: "رقم الفاتورة",
    customer: "العميل",
    date: "التاريخ",
    products: "المنتجات",
    qty: "الكمية",
    close: "إغلاق",
    myInvoicesTitle: "📄 فواتيري",
    loadingInvoices: "جاري تحميل الفواتير...",
    noInvoices: "لا توجد فواتير",
    invoiceDetails: "تفاصيل الفاتورة",
    changePinPrompt: "أدخل كلمة المرور الجديدة:",
    pinMustBeFour: "الرجاء إدخال كلمة المرور",
    pinChanged: "تم تغيير كلمة المرور",
    cartTitle: "سلة المشتريات",
    itemCount: "عدد المنتجات",
    selectBranch: "-- اختر الفرع --",
    branchLabel: "الفرع:",
    createInvoice: "📄 إنشاء فاتورة",
    invCartTitle: "المنتجات المجرودة",
    printInvInvoice: "طباعة فاتورة الجرد",
    invInvoiceModalTitle: "📄 طباعة فاتورة الجرد",
    notSet: "غير محدد",
    whatsapp: "💬 واتساب",
    clearCart: "🗑 حذف جميع المحتويات",
    backToStore: "← العودة للمتجر",
    cartEmpty: "🛒 السلة فارغة",
    noResults: "لا توجد نتائج",
    cartSearchPlaceholder: "🔍 ابحث في السلة...",
    cartRequiredMsg: "سجّل دخولك أولاً",
    cartRequiredSub: "سجّل دخولك للوصول إلى السلة",
    confirmDeleteCart: "تأكيد حذف السلة",
    confirmDeleteCartMsg: "سيتم حذف جميع المنتجات. للتأكيد اكتب",
    cancel: "إلغاء",
    delete: "حذف",
    emptyCart: "السلة فارغة",
    loginFirst: "سجل الدخول أولاً",
    invBlockTitle: "حساب جرد مخزون",
    invBlockMsg: "هذا الحساب مخصص لجرد المخزون فقط.",
    invBlockSub: "للوصول إلى سلة المشتريات، الرجاء تسجيل الدخول بحساب فرع.",
    goInventory: "📋 الذهاب لجرد المخزون",
    chooseBranch: "اختر الفرع أولاً",
    adminPanel: "لوحة الإدارة",
    invoicesView: "عرض الفواتير",
    dashboard: "Dashboard",
    menuStore: "المتجر",
    menuCart: "السلة",
    menuAdmin: "لوحة الإدارة",
    menuInvoices: "عرض الفواتير",
    menuAdmins: "إدارة المدراء",
    menuInvCart: "جرد المخزون",
    menuInvInvoices: "فواتير الجرد",
    menuCartPurchase: "سلة المشتريات",
    menuCartInventory: "سلة الجرد",
    menuInvoicesBranch: "فواتير الفروع",
    menuInvoicesInventory: "فواتير الجرد",
    menuAdminGeneral: "إدارة عامة",
    menuAdminManagers: "إدارة المدراء",
    menuAdminStats: "إحصائيات الطلبات",
    statsTitle: "إحصائيات الطلبات",
    statsPeriod: "الفترة",
    statsWeek: "هذا الأسبوع",
    statsMonth: "هذا الشهر",
    stats3Months: "آخر 3 أشهر",
    statsYear: "هذه السنة",
    statsCustom: "مخصص",
    statsFrom: "من",
    statsTo: "إلى",
    statsApply: "تطبيق",
    statsAllBranches: "كل الفروع",
    statsTotalInvoices: "إجمالي الفواتير",
    statsTotalQty: "إجمالي الكمية",
    statsDistinctProducts: "عدد المنتجات",
    statsProduct: "المنتج",
    statsArabicName: "الاسم بالعربي",
    statsCategory: "القسم",
    statsTotalQtyCol: "إجمالي الكمية",
    statsTimesOrdered: "عدد مرات الطلب",
    statsNoData: "لا توجد بيانات في هذه الفترة",
    statsLoading: "جاري تحميل البيانات...",
    adminLoginTitle: "لوحة الإدارة",
    adminLoginSubtitle: "الرجاء إدخال اسم المستخدم وكلمة المرور",
    adminUsername: "اسم المستخدم",
    adminPassword: "كلمة السر",
    adminLoginBtn: "دخول",
    adminLoginError: "",
    noCustomerPerm: "🔒 ليس لديك صلاحية إدارة المستخدمين",
    langToggle: "EN",
    selectCategory: "📦 اختر القسم لإضافة منتج جديد",
    backToCategories: "← العودة",
    addProductTo: "إضافة إلى:",
    arabicName: "الاسم بالعربي",
    englishName: "الاسم بالإنجليزي",
    productCode: "كود المنتج",
    suggestCode: "اقتراح كود",
    imageLink: "رابط الصورة",
    importExcel: "📥 استيراد من ملف إكسل",
    exportExcel: "📤 تصدير إلى إكسل",
    saveProduct: "💾 حفظ المنتج",
    allProducts: "جميع المنتجات",
    searchProduct: "🔍 البحث عن منتج...",
    sortNewest: "الأحدث",
    sortOldest: "الأقدم",
    sortNameAsc: "أ → ي",
    invoicesTab: "📄 الفواتير",
    productsTab: "🛒 المنتجات",
    customersTab: "👥 المستخدمين",
    branchesTab: "🏪 الفروع",
    adminsTab: "🔐 المدراء",
    allInvoices: "📄 جميع الفواتير",
    searchInvoice: "🔍 البحث بالعميل أو رقم الفاتورة...",
    addCustomer: "👥 إضافة عميل جديد",
    customerName: "اسم العميل",
    customerPin: "كلمة المرور",
    addCustomerBtn: "➕ إضافة عميل",
    searchCustomer: "🔍 البحث عن عميل...",
    manageBranches: "🏪 إدارة الفروع",
    branchName: "اسم الفرع",
    addBranchBtn: "➕ إضافة فرع",
    manageAdmins: "🔐 إدارة المدراء",
    adminUsernameLabel: "اسم المستخدم",
    adminPasswordLabel: "كلمة السر",
    addAdminBtn: "➕ إضافة مدير",
    addAdmin: "إضافة مدير جديد",
    adminManagement: "إدارة المدراء",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    newUsername: "اسم مستخدم جديد",
    newPassword: "كلمة مرور جديدة",
    enterUserPass: "أدخل اسم المستخدم وكلمة المرور",
    checking: "جاري التحقق...",
    you: "(أنت)",
    canAddProducts: "يمكن إضافة منتجات",
    noAddPermForCat: "ليس لديك صلاحية إضافة منتجات لهذا القسم",
    manageCustomers: "إدارة العملاء",
    permissions: "الصلاحيات",
    categoryVisibility: "إظهار الأقسام",
    noAdmins: "لا يوجد مدراء",
    enterAtLeastOne: "أدخل حقلاً واحداً على الأقل",
    noChanges: "لا توجد تغييرات",
    profileUpdated: "تم تحديث الملف الشخصي",
    saveBtn: "💾 حفظ",
    editBranch: "تعديل اسم الفرع",
    branchNameFormat: "أدخل الاسم بهذا الشكل: الاسم بالعربي - الاسم بالإنجليزية",
    branchNameAr: "اسم الفرع بالعربي",
    branchNameEn: "اسم الفرع بالإنجليزية",
    usernameExists: "اسم المستخدم موجود مسبقاً",
    labNeeds: "احتياجات المعمل",
    confirmDelete: "Yes",
    cancelDelete: "إلغاء",
    deleteConfirm: "حذف",
    deleteCustomerTitle: "حذف العميل",
    deleteCustomerMsg: "هل أنت متأكد من حذف",
    deleteInvoiceTitle: "حذف الفاتورة",
    deleteInvoiceMsg: "هل أنت متأكد من حذف فاتورة",
    adminLoginChecking: "جاري التحقق...",
    adminLoginError: "اسم المستخدم أو كلمة المرور خاطئة",
    adminConnError: "خطأ في الاتصال",
    loadingProducts: "جاري تحميل المنتجات...",
    loadingCustomers: "جاري تحميل المستخدمين...",
    loadingInvoicesAdmin: "جاري تحميل الفواتير...",
    errorOccurred: "حدث خطأ",
    noCustomers: "لا يوجد مستخدمين",
    noInvoicesAdmin: "لا توجد فواتير",
    noBranches: "لا توجد فروع",
    noAdmins: "لا يوجد مدراء",
    showDetails: "عرض التفاصيل",
    hideDetails: "إخفاء",
    showInvoices: "عرض الفواتير",
    hideInvoices: "إخفاء الفواتير",
    deleteProduct: "حذف المنتج؟",
    deleteAdmin: "حذف المدير؟",
    fillRequired: "يرجى تعبئة جميع الحقول المطلوبة",
    productUpdated: "تم تعديل المنتج",
    productAdded: "تم إضافة المنتج",
    errorSaving: "حدث خطأ أثناء الحفظ",
    customerAdded: "تم إضافة العميل بنجاح",
    customerExists: "العميل موجود مسبقاً",
    nameMinTwo: "الاسم يجب أن يكون حرفين على الأقل",
    pinMustFourDigits: "الرجاء إدخال كلمة المرور",
    adminAdded: "تم إضافة المدير",
    adminExists: "الاسم موجود مسبقاً",
    adminMinThree: "3 أحرف على الأقل",
    fillUserPass: "أدخل اسم المستخدم وكلمة المرور",
    branchAdded: "تمت إضافة الفرع",
    branchExists: "الفرع موجود مسبقاً",
    enterBranchName: "أدخل اسم الفرع",
    deletedSuccessfully: "تم الحذف بنجاح",
    errorOccurredShort: "حدث خطأ",
    timeout: "انتهت المهلة",
    importing: "جاري التصدير...",
    productsExported: " منتج تم استيراده",
    noProductsExport: "لا توجد منتجات",
    excelLoadError: "تعذر تحميل مكتبة Excel",
    errorImport: "حدث خطأ أثناء الاستيراد",
    errorExport: "حدث خطأ أثناء التصدير",
    pdfDownloaded: "تم تحميل",
    pdfError: "خطأ في إنشاء PDF",
    uploading: "جاري التحميل...",
    invoicesViewTitle: "📄 عرض الفواتير",
    invoicesViewSub: "عرض الفواتير - للقراءة فقط",
    searchInvoiceView: "🔍 البحث بالعميل أو رقم الفاتورة...",
    loadingInvoicesView: "جاري تحميل الفواتير...",
    noInvoicesView: "لا توجد فواتير",
    showDetailsView: "عرض التفاصيل",
    hideDetailsView: "إخفاء",
    printBtn: "🖨 طباعة",
    dashboardTitle: "لوحة التحكم",
    dashboardSub: "اختر القسم",
    dashStore: "🛒 المتجر",
    dashAdmin: "⚙️ لوحة الإدارة",
    dashInvoices: "📄 عرض الفواتير",
    editBtn: "تعديل",
    deleteBtn: "حذف",
    registrationDate: "تاريخ التسجيل:",
    changeAccountType: "تغيير نوع الحساب",
    allProducts: "جميع المنتجات",
    uploadImage: "📷 إدراج من معرض الصور",
    importExcelLabel: "📥 استيراد من ملف إكسل",
    exportExcelLabel: "📤 تصدير إلى إكسل",
    accountTypeLab: "جرد مخزون",
    accountTypeBranch: "حساب فرع 🏪",
    noProductsInCategory: "لا توجد منتجات في هذا القسم",
    productsInCategory: "منتجات القسم",
    noProductsSelected: "لم يتم تحديد أي منتج",
    selectCategoryFirst: "اختر القسم الجديد أولاً",
    bulkSelectAll: "تحديد الكل",
    bulkCategoryPlaceholder: "-- القسم الجديد --",
    bulkChangeBtn: "تغيير القسم",
    permissionsLabel: "🔐 صلاحيات الأقسام",
    savePerms: "💾 حفظ الصلاحيات",
    save: "حفظ",
    resetPerms: "🔄 إعادة التعيين",
    permsSaved: "تم حفظ الصلاحيات بنجاح",
    permsReset: "تم إعادة التعيين إلى الإعدادات الافتراضية",
    categoriesTab: "📂 الأقسام",
    renameCategory: "تعديل",
    deleteCategory: "حذف",
    renamePrompt: "أدخل الاسم الجديد للقسم:",
    renameSuccess: "تم تعديل اسم القسم بنجاح",
    deleteCategoryConfirm: "سيتم ترك المنتجات بدون تصنيف بعد حذف القسم. يتوجب عليك إدراجها في قسم جديد لاحقاً. هل أنت متأكد؟",
    deleteCategoryConfirmType: "اكتب Yes للتأكيد",
    deleteCategorySuccess: "تم حذف القسم، وتركت المنتجات بدون تصنيف",
    catProductsBack: "← العودة",
    addProductToCat: "➕ إضافة منتج للقسم",
    noProductsInCat: "لا توجد منتجات في هذا القسم",
    addNewCategory: "➕ إضافة قسم جديد",
    categoryNameAr: "اسم القسم بالعربي",
    categoryNameEn: "اسم القسم بالإنجليزية",
    categoryDesc: "وصف القسم (اختياري)",
    showDescription: "إظهار الوصف في القائمة",
    renameCatTitle: "تعديل اسم القسم",
    addCatTitle: "إضافة قسم جديد",
    cancel: "إلغاء",
  },
  en: {
    searchPlaceholder: "🔍 Search products...",
    login: "🔑 Login",
    loginTitle: "Login",
    loginSubtitle: "Select account type, name and enter PIN",
    accountType: "-- Account Type --",
    accountTypeLab: "Inventory Account",
    accountTypeBranch: "Branch Account",
    selectName: "-- Select Name --",
    pinPlaceholder: "Password",
    submit: "Login",
    name: "Name:",
    type: "Type:",
    show: "Show",
    hide: "Hide",
    changePin: "🔑 Change PIN",
    myInvoices: "📄 My Invoices",
    logout: "🚪 Logout",
    logoutConfirm: "Are you sure you want to logout?",
    welcomeMsg: "Welcome to SimSim",
    welcomeSub: "Login to access products",
    loginBtnOverlay: "🔑 Login",
    addedToCart: "Added!",
    addToCart: "Add to Cart",
    noProducts: "No products in this section",
    loading: "Loading products...",
    selectAccountType: "Select account type",
    selectNameErr: "Select a name",
    pinFourDigits: "Please enter password",
    enterPin: "Please enter password",
    accountNotFound: "Account not found",
    wrongPassword: "Wrong PIN",
        inventoryAccountRequired: "This account cannot access the inventory page. Use an Inventory Account.",
    invoiceNum: "Invoice No",
    customer: "Customer",
    date: "Date",
    products: "Products",
    qty: "Qty",
    close: "Close",
    myInvoicesTitle: "📄 My Invoices",
    loadingInvoices: "Loading invoices...",
    noInvoices: "No invoices yet",
    invoiceDetails: "Invoice Details",
    changePinPrompt: "Enter new password:",
    pinMustBeFour: "Please enter password",
    pinChanged: "PIN changed successfully",
    cartTitle: "Shopping Cart",
    itemCount: "Item Count",
    selectBranch: "-- Select Branch --",
    branchLabel: "Branch:",
    createInvoice: "📄 Create Invoice",
    invCartTitle: "Inventory Count",
    printInvInvoice: "Print Inventory Invoice",
    invInvoiceModalTitle: "📄 Print Inventory Invoice",
    notSet: "Not set",
    whatsapp: "💬 WhatsApp",
    clearCart: "🗑 Clear All Items",
    backToStore: "← Back to Store",
    cartEmpty: "🛒 Cart is empty",
    noResults: "No results found",
    cartSearchPlaceholder: "🔍 Search in cart...",
    cartRequiredMsg: "Please login first",
    cartRequiredSub: "Login to access the cart",
    confirmDeleteCart: "Confirm Cart Deletion",
    confirmDeleteCartMsg: "All items will be deleted. Type to confirm:",
    cancel: "Cancel",
    delete: "Delete",
    emptyCart: "Cart is empty",
    loginFirst: "Please login first",
    invBlockTitle: "Inventory Account",
    invBlockMsg: "This account is for inventory counting only.",
    invBlockSub: "To access the purchase cart, please login with a branch account.",
    goInventory: "📋 Go to Inventory",
    chooseBranch: "Select a branch first",
    adminPanel: "Admin Panel",
    invoicesView: "Invoices View",
    dashboard: "Dashboard",
    menuStore: "Store",
    menuCart: "Cart",
    menuAdmin: "Admin Panel",
    menuInvoices: "Invoices",
    menuAdmins: "Admin Management",
    menuInvCart: "Inventory Count",
    menuInvInvoices: "Inventory Invoices",
    menuCartPurchase: "Purchase Cart",
    menuCartInventory: "Inventory Cart",
    menuInvoicesBranch: "Branch Invoices",
    menuInvoicesInventory: "Inventory Invoices",
    menuAdminGeneral: "General Admin",
    menuAdminManagers: "Admin Management",
    menuAdminStats: "Order Statistics",
    statsTitle: "Order Statistics",
    statsPeriod: "Period",
    statsWeek: "This Week",
    statsMonth: "This Month",
    stats3Months: "Last 3 Months",
    statsYear: "This Year",
    statsCustom: "Custom",
    statsFrom: "From",
    statsTo: "To",
    statsApply: "Apply",
    statsAllBranches: "All Branches",
    statsTotalInvoices: "Total Invoices",
    statsTotalQty: "Total Qty",
    statsDistinctProducts: "Products",
    statsProduct: "Product",
    statsArabicName: "Arabic Name",
    statsCategory: "Category",
    statsTotalQtyCol: "Total Qty",
    statsTimesOrdered: "Times Ordered",
    statsNoData: "No data in this period",
    statsLoading: "Loading data...",
    adminLoginTitle: "Admin Panel",
    adminLoginSubtitle: "Enter username and password",
    adminUsername: "Username",
    adminPassword: "Password",
    adminLoginBtn: "Login",
    adminLoginError: "",
    noCustomerPerm: "🔒 You don't have permission to manage customers",
    langToggle: "عربي",
    selectCategory: "📦 Select a category to add products",
    backToCategories: "← Back",
    addProductTo: "Add to:",
    arabicName: "Arabic Name",
    englishName: "English Name",
    productCode: "Product Code",
    suggestCode: "Suggest Code",
    imageLink: "Image URL",
    importExcel: "📥 Import from Excel",
    exportExcel: "📤 Export to Excel",
    saveProduct: "💾 Save Product",
    allProducts: "All Products",
    searchProduct: "🔍 Search products...",
    sortNewest: "Newest",
    sortOldest: "Oldest",
    sortNameAsc: "A → Z",
    invoicesTab: "📄 Invoices",
    productsTab: "🛒 Products",
    customersTab: "👥 Users",
    branchesTab: "🏪 Branches",
    adminsTab: "🔐 Admins",
    allInvoices: "📄 All Invoices",
    searchInvoice: "🔍 Search by customer or invoice...",
    addCustomer: "👥 Add New Customer",
    customerName: "Customer Name",
    customerPin: "PIN (4 digits)",
    addCustomerBtn: "➕ Add Customer",
    searchCustomer: "🔍 Search customer...",
    manageBranches: "🏪 Manage Branches",
    branchName: "Branch Name",
    addBranchBtn: "➕ Add Branch",
    manageAdmins: "🔐 Manage Admins",
    adminUsernameLabel: "Username",
    adminPasswordLabel: "Password",
    addAdminBtn: "➕ Add Admin",
    addAdmin: "Add New Admin",
    adminManagement: "Admin Management",
    username: "Username",
    password: "Password",
    newUsername: "New username",
    newPassword: "New password",
    enterUserPass: "Enter username and password",
    checking: "Checking...",
    you: "(you)",
    canAddProducts: "Can add products",
    noAddPermForCat: "You don't have permission to add products to this category",
    manageCustomers: "Manage customers",
    permissions: "Permissions",
    categoryVisibility: "Category visibility",
    noAdmins: "No admins",
    enterAtLeastOne: "Enter at least one field",
    noChanges: "No changes",
    profileUpdated: "Profile updated",
    saveBtn: "💾 Save",
    editBranch: "Edit Branch Name",
    branchNameFormat: "Enter the name as: Arabic name - English name",
    branchNameAr: "Branch name (Arabic)",
    branchNameEn: "Branch name (English)",
    usernameExists: "Username already exists",
    labNeeds: "Lab Needs",
    confirmDelete: "Yes",
    cancelDelete: "Cancel",
    deleteConfirm: "Delete",
    deleteCustomerTitle: "Delete Customer",
    deleteCustomerMsg: "Are you sure you want to delete",
    deleteInvoiceTitle: "Delete Invoice",
    deleteInvoiceMsg: "Are you sure you want to delete invoice",
    adminLoginChecking: "Checking...",
    adminLoginError: "Wrong username or password",
    adminConnError: "Connection error",
    loadingProducts: "Loading products...",
    loadingCustomers: "Loading users...",
    loadingInvoicesAdmin: "Loading invoices...",
    errorOccurred: "An error occurred",
    noCustomers: "No users",
    noInvoicesAdmin: "No invoices",
    noBranches: "No branches",
    noAdmins: "No admins",
    showDetails: "Show Details",
    hideDetails: "Hide",
    showInvoices: "Show Invoices",
    hideInvoices: "Hide Invoices",
    deleteProduct: "Delete product?",
    deleteAdmin: "Delete admin?",
    fillRequired: "Please fill all required fields",
    productUpdated: "Product updated",
    productAdded: "Product added",
    errorSaving: "Error saving",
    customerAdded: "Customer added successfully",
    customerExists: "Customer already exists",
    nameMinTwo: "Name must be at least 2 characters",
    pinMustFourDigits: "Please enter password",
    adminAdded: "Admin added",
    adminExists: "Name already exists",
    adminMinThree: "At least 3 characters",
    fillUserPass: "Enter username and password",
    branchAdded: "Branch added",
    branchExists: "Branch already exists",
    enterBranchName: "Enter branch name",
    deletedSuccessfully: "Deleted successfully",
    errorOccurredShort: "An error occurred",
    timeout: "Timeout",
    importing: "Exporting...",
    productsExported: " products imported",
    noProductsExport: "No products",
    excelLoadError: "Failed to load Excel library",
    errorImport: "Error importing",
    errorExport: "Error exporting",
    pdfDownloaded: "Downloaded",
    pdfError: "Error generating PDF",
    loading: "Loading...",
    invoicesViewTitle: "📄 Invoices View",
    invoicesViewSub: "Read-only invoice listing",
    searchInvoiceView: "🔍 Search by customer or invoice number...",
    loadingInvoicesView: "Loading invoices...",
    noInvoicesView: "No invoices found",
    showDetailsView: "Show Details",
    hideDetailsView: "Hide",
    printBtn: "🖨 Print",
    dashboardTitle: "Dashboard",
    dashboardSub: "Choose a section",
    dashStore: "🛒 Store",
    dashAdmin: "⚙️ Admin Panel",
    dashInvoices: "📄 Invoices View",
    editBtn: "Edit",
    deleteBtn: "Delete",
    registrationDate: "Registration date:",
    changeAccountType: "Change account type",
    allProducts: "All Products",
    uploadImage: "📷 Upload from Gallery",
    importExcelLabel: "📥 Import from Excel",
    exportExcelLabel: "📤 Export to Excel",
    accountTypeLab: "Inventory Account",
    accountTypeBranch: "Branch Account 🏪",
    noProductsInCategory: "No products in this category",
    productsInCategory: "Category Products",
    noProductsSelected: "No products selected",
    selectCategoryFirst: "Select a category first",
    bulkSelectAll: "Select All",
    bulkCategoryPlaceholder: "-- New Category --",
    bulkChangeBtn: "Change Category",
    permissionsLabel: "🔐 Category Permissions",
    savePerms: "💾 Save Permissions",
    save: "Save",
    resetPerms: "🔄 Reset to Defaults",
    permsSaved: "Permissions saved",
    permsReset: "Reset to defaults",
    categoriesTab: "📂 Categories",
    renameCategory: "Rename",
    deleteCategory: "Delete",
    renamePrompt: "Enter new category name:",
    renameSuccess: "Category renamed successfully",
    deleteCategoryConfirm: "Products will be left unclassified after deleting this category. You will need to reassign them to another category later. Are you sure?",
    deleteCategoryConfirmType: "Type Yes to confirm",
    deleteCategorySuccess: "Category deleted, products left unclassified",
    catProductsBack: "← Back",
    addProductToCat: "➕ Add Product to Category",
    noProductsInCat: "No products in this category",
    addNewCategory: "➕ Add New Category",
    categoryNameAr: "Category name (Arabic)",
    categoryNameEn: "Category name (English)",
    categoryDesc: "Description (optional)",
    showDescription: "Show description in menu",
    renameCatTitle: "Rename Category",
    addCatTitle: "Add New Category",
    cancel: "Cancel",
  }
};

export function getLang(){ return localStorage.getItem(LANG_KEY) || "en"; }
export function setLang(lang){ localStorage.setItem(LANG_KEY, lang); }
export function t(key){ return (T[getLang()] || T.ar)[key] || key; }
export function catLabel(catKey){ 
  try{const m=JSON.parse(localStorage.getItem("simsim_cat_meta"))||{};if(m[catKey])return getLang()==="en"?(m[catKey].nameEn||catKey):catKey;}catch(e){}
  const labels=(CAT_LABELS[getLang()]||CAT_LABELS.ar);
  if(labels[catKey])return labels[catKey];
  return catKey;
}
export function catImage(catKey){ const imgs = CAT_IMAGES[catKey]; if(!imgs) return null; return imgs[getLang()] || imgs.ar; }

export function applyMenuLang(){
  const lang = getLang();
  const isEn = lang === "en";
  document.querySelectorAll("#dashMenuDropdown a, #dashMenuDropdown .dash-toggle").forEach(el => {
    const key = el.getAttribute("data-i18n-menu");
    if(!key) return;
    const icon = el.querySelector(".dash-icon");
    const iconHtml = icon ? icon.outerHTML : '';
    const arrow = el.querySelector(".dash-arrow");
    const arrowHtml = arrow ? arrow.outerHTML : '';
    el.innerHTML = iconHtml + ' ' + t(key) + ' ' + arrowHtml;
  });
}

export function applyFullLang(selectors){
  const lang = getLang();
  const isEn = lang === "en";
  document.documentElement.lang = lang;
  document.documentElement.dir = isEn ? "ltr" : "rtl";

  if(selectors?.langToggle){
    const btn = document.getElementById(selectors.langToggle);
    if(btn) btn.textContent = isEn ? "🌐 عربي" : "🌐 EN";
  }

  if(selectors?.search) {
    const el = document.getElementById(selectors.search);
    if(el) el.placeholder = t("searchPlaceholder");
  }

  if(selectors?.loginBtn){
    const el = document.getElementById(selectors.loginBtn);
    if(el) el.innerHTML = t("login");
  }

  if(selectors?.loginRequiredOverlay){
    const ov = document.getElementById(selectors.loginRequiredOverlay);
    if(ov){
      const h2 = ov.querySelector("h2");
      const p = ov.querySelector("p");
      const btn = ov.querySelector("button");
      if(h2) h2.textContent = t("welcomeMsg");
      if(p) p.textContent = t("welcomeSub");
      if(btn) btn.textContent = t("loginBtnOverlay");
    }
  }

  if(selectors?.loginModal){
    const m = document.getElementById(selectors.loginModal);
    if(m){
      const h2 = m.querySelector("h2");
      const sub = m.querySelector(".login-subtitle");
      if(h2) h2.textContent = t("loginTitle");
      if(sub) sub.textContent = t("loginSubtitle");
      const sel = m.querySelector("#loginAccountType");
      if(sel && sel.options.length >= 3){
        sel.options[0].textContent = t("accountType");
        sel.options[1].textContent = t("accountTypeLab");
        sel.options[2].textContent = t("accountTypeBranch");
      }
      const nameSel = m.querySelector("#loginName");
      if(nameSel){
        const def = nameSel.querySelector('option[value=""]');
        if(def) def.textContent = t("selectName");
      }
      const pin = m.querySelector("#loginPin");
      if(pin) pin.placeholder = t("pinPlaceholder");
      const subBtn = m.querySelector("#loginSubmit");
      if(subBtn) subBtn.textContent = t("submit");
    }
  }

  if(selectors?.profile){
    const items = document.querySelectorAll("#profileDropdown .profile-dropdown-item");
    if(items[0]){ const s = items[0].querySelector("strong"); if(s) s.textContent = t("name"); }
    if(items[1]){ const s = items[1].querySelector("strong"); if(s) s.textContent = t("type"); }
    if(items[3]){ const b = items[3].querySelector("button"); if(b) b.textContent = t("changePin"); }
    if(items[4]){ const b = items[4].querySelector("button"); if(b) b.textContent = t("myInvoices"); }
    if(items[5]){ const b = items[5].querySelector("button"); if(b) b.textContent = t("logout"); }
    const pt = document.getElementById("profileType");
    if(pt && !pt.dataset.raw) pt.textContent = pt.textContent;
    const profileTogglePin = document.getElementById("profileTogglePin");
    if(profileTogglePin){
      const el = document.getElementById("profilePin");
      if(el) profileTogglePin.textContent = el.textContent === "****" ? t("show") : t("hide");
    }
  }

  document.querySelectorAll(".cat-label[data-i18n-cat]").forEach(el => {
    el.textContent = catLabel(el.getAttribute("data-i18n-cat"));
  });

  document.querySelectorAll("[data-i18n]:not([data-i18n-cat])").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });

  applyMenuLang();
}

export function applyCartLang(){
  applyMenuLang();
  const lang = getLang();
  const isEn = lang === "en";

  // Header
  const h1 = document.querySelector(".store-header h1");
  if(h1) h1.textContent = t("cartTitle");
  document.querySelectorAll(".store-header [data-i18n]").forEach(el=>{const k=el.getAttribute("data-i18n");if(k&&t(k)!==k)el.textContent=t(k);});

  // Category labels
  document.querySelectorAll(".cat-card .cat-label").forEach(el => {
    const card = el.closest("[data-cat]");
    if(card) el.textContent = catLabel(card.dataset.cat);
  });

  // Login required overlay
  const overlay = document.getElementById("loginRequiredOverlay");
  if(overlay){
    const oh2 = overlay.querySelector("h2");
    const op = overlay.querySelector("p");
    const obtn = overlay.querySelector("button");
    if(oh2) oh2.textContent = t("loginFirst");
    if(op) op.textContent = t("cartRequiredSub");
    if(obtn) obtn.textContent = t("loginBtnOverlay");
  }

  // Inventory block overlay
  document.querySelectorAll("#inventoryBlockOverlay [data-i18n]").forEach(el=>{
    const k = el.getAttribute("data-i18n");
    if(k && t(k) !== k) el.textContent = t(k);
  });

  // Cart summary
  const summaryH2 = document.querySelector(".cart-summary h2");
  if(summaryH2) summaryH2.textContent = t("itemCount");
  const createInv = document.getElementById("createInvoice");
  if(createInv) createInv.textContent = t("createInvoice");
  const whatsappBtn = document.getElementById("whatsappBtn");
  if(whatsappBtn) whatsappBtn.textContent = t("whatsapp");
  const clearCartBtn = document.getElementById("clearCartBtn");
  if(clearCartBtn) clearCartBtn.textContent = t("clearCart");
  const backStore = document.querySelector(".cart-summary .back-btn");
  if(backStore) backStore.textContent = t("backToStore");

  // Mobile cart elements
  document.querySelectorAll("#cartTopBar [data-i18n]").forEach(el=>{const k=el.getAttribute("data-i18n");if(k&&t(k)!==k)el.textContent=t(k);});
  const invFab=document.getElementById("invoiceFab");
  if(invFab)invFab.title=t("createInvoice");
  const invModTitle=document.querySelector("#invoiceModal h2 span");
  if(invModTitle)invModTitle.textContent=t("createInvoice");
  const createInvMob=document.getElementById("createInvoiceMobile");
  if(createInvMob)createInvMob.querySelector("span").textContent=t("createInvoice");
  const whatsMob=document.getElementById("whatsappMobile");
  if(whatsMob)whatsMob.querySelector("span").textContent=t("whatsapp");

  // Cart search
  const cartSearch = document.getElementById("cartSearch");
  if(cartSearch) cartSearch.placeholder = t("cartSearchPlaceholder");

  // Login modal
  const lmH2 = document.querySelector("#loginModal h2");
  const lmSub = document.querySelector("#loginModal .login-subtitle");
  if(lmH2) lmH2.textContent = t("loginTitle");
  if(lmSub) lmSub.textContent = t("loginSubtitle");
  const sel = document.getElementById("loginAccountType");
  if(sel && sel.options.length >= 3){
    sel.options[0].textContent = t("accountType");
    sel.options[1].textContent = t("accountTypeLab");
    sel.options[2].textContent = t("accountTypeBranch");
  }
  const nameSel = document.getElementById("loginName");
  if(nameSel){
    const def = nameSel.querySelector('option[value=""]');
    if(def) def.textContent = t("selectName");
  }
  const pin = document.getElementById("loginPin");
  if(pin) pin.placeholder = t("pinPlaceholder");
  const subBtn = document.getElementById("loginSubmit");
  if(subBtn) subBtn.textContent = t("submit");

  // Profile
  applyFullLang({ profile: true });

  // Invoices modal
  const invH2 = document.querySelector("#invoicesModal h2");
  if(invH2) invH2.textContent = t("myInvoicesTitle");
  const invClose = document.getElementById("invoicesCloseBtn");
  if(invClose) invClose.textContent = t("close");

  // Clear cart modal
  const ccH3 = document.querySelector("#clearCartConfirmModal h3");
  const ccP = document.querySelector("#clearCartConfirmModal p");
  const ccCancel = document.getElementById("cancelClearCart");
  const ccConfirm = document.getElementById("confirmClearCart");
  if(ccH3) ccH3.textContent = t("confirmDeleteCart");
  if(ccP) ccP.textContent = t("confirmDeleteCartMsg");
  if(ccCancel) ccCancel.textContent = t("cancel");
  if(ccConfirm) ccConfirm.textContent = t("delete");

  // Header profile dropdown
  const ddItems = document.querySelectorAll("#profileDropdown .profile-dropdown-item");
  if(ddItems[0]){ const s = ddItems[0].querySelector("strong"); if(s) s.textContent = t("name"); }
  if(ddItems[1]){ const s = ddItems[1].querySelector("strong"); if(s) s.textContent = t("type"); }
  if(ddItems[3]){ const b = ddItems[3].querySelector("button"); if(b) b.textContent = t("changePin"); }
  if(ddItems[4]){ const b = ddItems[4].querySelector("button"); if(b) b.textContent = t("myInvoices"); }
  if(ddItems[5]){ const b = ddItems[5].querySelector("button"); if(b) b.textContent = t("logout"); }
  const profileTogglePin = document.getElementById("profileTogglePin");
  if(profileTogglePin){
    const el = document.getElementById("profilePin");
    if(el) profileTogglePin.textContent = el.textContent === "****" ? t("show") : t("hide");
  }
}
