const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuración de almacenamiento para archivos subidos por docentes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fs = require('fs');
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads');
    }
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Conexión a MongoDB (Usa tu variable de entorno en Render o local)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/plataforma_educativa';
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Conectado a MongoDB'))
.catch(err => console.error('Error conectando a MongoDB:', err));

// Modelos de Base de Datos
const UserSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  rol: { type: String, enum: ['admin', 'docente', 'estudiante'], default: 'estudiante' },
  progreso: [{
    cursoId: mongoose.Schema.Types.ObjectId,
    completado: { type: Boolean, default: false },
    calificacion: { type: Number, default: 0 }
  }]
}, { timestamps: true });

const ContenidoSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  descripcion: { type: String },
  tipo: { type: String, enum: ['archivo', 'enlace'], required: true },
  url: { type: String, required: true },
  docenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Contenido = mongoose.model('Contenido', ContenidoSchema);

// --- RUTAS DE LA API ---

// Crear Usuario (Admin)
app.post('/api/usuarios', async (req, res) => {
  try {
    const nuevoUsuario = new User(req.body);
    await nuevoUsuario.save();
    res.status(201).json({ mensaje: 'Usuario creado exitosamente', usuario: nuevoUsuario });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener Usuarios
app.get('/api/usuarios', async (req, res) => {
  try {
    const usuarios = await User.find();
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Subir Contenido (Docente: Archivos o Enlaces)
app.post('/api/contenido', upload.single('archivo'), async (req, res) => {
  try {
    const { titulo, descripcion, tipo, docenteId, urlExterna } = req.body;
    let urlFinal = urlExterna;

    if (tipo === 'archivo' && req.file) {
      urlFinal = `/uploads/${req.file.filename}`;
    }

    const nuevoContenido = new Contenido({
      titulo,
      descripcion,
      tipo,
      url: urlFinal,
      docenteId
    });

    await nuevoContenido.save();
    res.status(201).json({ mensaje: 'Contenido publicado con éxito', contenido: nuevoContenido });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ver Contenidos (Estudiantes y Docentes)
app.get('/api/contenido', async (req, res) => {
  try {
    const contenidos = await Contenido.find().populate('docenteId', 'nombre email');
    res.json(contenidos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ver Progreso de Estudiantes
app.get('/api/progreso/:estudianteId', async (req, res) => {
  try {
    const estudiante = await User.findById(req.params.estudianteId);
    if (!estudiante || estudiante.rol !== 'estudiante') {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    res.json({ estudiante: estudiante.nombre, progreso: estudiante.progreso });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));