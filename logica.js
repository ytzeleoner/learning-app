const { createApp, ref, onMounted, reactive } = Vue;

createApp({
  setup() {
    // Refs para datos
    const areas = ref([]);
    const conocimientos = ref([]);
    const temas = ref([]);
    const ultimosTemas = ref([]);
    const preguntas = ref([]);
    const preguntasPendientes = ref([]);
    const progresos = ref([]);
    const respuestaSeleccionada = reactive({});
    const respuestaUsuarioModal = ref(null);
    const mostrarModal = ref(false);
    const modalEsCorrecto = ref(false);
    const modalNivel = ref(0);
    const mostrarModalReset = ref(false);
    const puntosTotales = ref(0);
    const insignias = ref([]);
    const preguntaActual = ref(null);
    const vistaActual = ref('diario');
    const temaSeleccionado = ref(null);
    const preguntaActualIndex = ref(0);
    const preguntasCuestionario = ref([]);
    const mostrarModalCredenciales = ref(false);
    const tempSpreadsheetId = ref(localStorage.getItem('spreadsheetId') || '');
    const tempApiKey = ref(localStorage.getItem('apiKey') || '');
    const tempClientId = ref(localStorage.getItem('clientId') || '');
    const spreadsheetId = ref(localStorage.getItem('spreadsheetId') || '');
    const apiKey = ref(localStorage.getItem('apiKey') || '');
    const clientId = ref(localStorage.getItem('clientId') || '');
    const mostrarModalAuth = ref(false);
    const accessToken = ref(localStorage.getItem('accessToken') || null);
    const isSignedIn = ref(!!accessToken.value);
    const userId = ref(localStorage.getItem('userId') || '');
    const tempUserId = ref(userId.value);
    const mostrarModalUserId = ref(false);
    const expanded = ref({
      area: {},
      conocimiento: {},
      tema: {}
    });

    // Handle image loading errors
    const handleImageError = (event) => {
      console.warn('Image failed to load:', event.target.src);
      event.target.src = 'https://via.placeholder.com/150?text=Imagen+No+Disponible';
    };

    // Validate access token
    const verifyToken = async (token) => {
      try {
        const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${token}`);
        const tokenInfo = await response.json();
        if (tokenInfo.error) {
          console.error('Token invalid or expired:', tokenInfo.error);
          localStorage.removeItem('accessToken');
          accessToken.value = null;
          isSignedIn.value = false;
          mostrarModalAuth.value = true;
          return false;
        }
        console.log('Token valid:', tokenInfo);
        isSignedIn.value = true;
        mostrarModalAuth.value = false;
        return true;
      } catch (error) {
        console.error('Error verifying token:', error);
        localStorage.removeItem('accessToken');
        accessToken.value = null;
        isSignedIn.value = false;
        mostrarModalAuth.value = true;
        return false;
      }
    };

    // Initialize Google Identity Services
    const initGoogleAuth = async () => {
      if (!clientId.value) {
        console.error('Client ID not available, showing credentials modal');
        mostrarModalCredenciales.value = true;
        return;
      }
      const waitForGoogle = (attempts = 20, interval = 500) => {
        return new Promise((resolve) => {
          if (window.google && window.google.accounts && window.google.accounts.oauth2) {
            console.log('Google Identity Services library loaded');
            const client = google.accounts.oauth2.initTokenClient({
              client_id: clientId.value,
              scope: 'https://www.googleapis.com/auth/spreadsheets',
              callback: (response) => {
                console.log('OAuth callback response:', response);
                if (response.access_token) {
                  accessToken.value = response.access_token;
                  localStorage.setItem('accessToken', response.access_token);
                  isSignedIn.value = true;
                  mostrarModalAuth.value = false;
                  guardarProgresosEnSheets();
                } else {
                  console.error('No access token received:', response.error || 'Unknown error');
                  isSignedIn.value = false;
                  accessToken.value = null;
                  mostrarModalAuth.value = true;
                }
              },
              error_callback: (error) => {
                console.error('OAuth error:', JSON.stringify(error, null, 2));
                isSignedIn.value = false;
                accessToken.value = null;
                mostrarModalAuth.value = true;
              }
            });
            window.googleAuthClient = client;
            console.log('Google Identity Services initialized successfully');
            resolve();
          } else if (attempts > 0) {
            console.log('Google Identity Services not loaded yet, retrying... Attempts left:', attempts);
            setTimeout(() => waitForGoogle(attempts - 1, interval).then(resolve), interval);
          } else {
            console.error('Failed to load Google Identity Services after retries');
            mostrarModalAuth.value = true;
            resolve();
          }
        });
      };
      await waitForGoogle();
      if (accessToken.value) {
        await verifyToken(accessToken.value);
      } else {
        mostrarModalAuth.value = true;
      }
    };

    // Iniciar sesión con Google
    const iniciarSesionGoogle = async () => {
      console.log('Attempting Google sign-in');
      if (!window.googleAuthClient) {
        console.error('Google auth client not initialized, retrying initialization');
        await initGoogleAuth();
      }
      if (window.googleAuthClient) {
        window.googleAuthClient.requestAccessToken();
      } else {
        console.error('Failed to initialize Google auth client');
        mostrarModalAuth.value = true;
      }
    };

    // Cerrar modal de autenticación
    const cerrarModalAuth = () => {
      console.log('Closing auth modal');
      mostrarModalAuth.value = false;
      localStorage.setItem('progresos', JSON.stringify(progresos.value));
      localStorage.setItem('puntos', puntosTotales.value.toString());
      localStorage.setItem('insignias', JSON.stringify(insignias.value));
    };

    // Validate credentials with a test API call
    const validateCredentials = async () => {
      if (!tempSpreadsheetId.value || !tempApiKey.value) {
        console.warn('Incomplete credentials for validation');
        return false;
      }
      try {
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${tempSpreadsheetId.value}/values/Areas!A1?key=${tempApiKey.value}`
        );
        if (!response.ok) {
          console.error('Credential validation failed:', response.status);
          return false;
        }
        return true;
      } catch (error) {
        console.error('Error validating credentials:', error);
        return false;
      }
    };

    // Guardar credenciales en localStorage
    const guardarCredenciales = async () => {
      if (!tempSpreadsheetId.value || !tempApiKey.value || !tempClientId.value) {
        console.error('Incomplete credentials provided');
        alert('Por favor, completa todos los campos.');
        return;
      }
      const isValid = await validateCredentials();
      if (!isValid) {
        console.error('Invalid credentials, keeping modal open');
        alert('Credenciales inválidas. Verifica el Spreadsheet ID y la API Key.');
        return;
      }
      localStorage.setItem('spreadsheetId', tempSpreadsheetId.value);
      localStorage.setItem('apiKey', tempApiKey.value);
      localStorage.setItem('clientId', tempClientId.value);
      spreadsheetId.value = tempSpreadsheetId.value;
      apiKey.value = tempApiKey.value;
      clientId.value = tempClientId.value;
      console.log('Credentials saved:', { spreadsheetId: spreadsheetId.value, apiKey: apiKey.value, clientId: clientId.value });
      mostrarModalCredenciales.value = false;
      await initGoogleAuth();
      await cargarDatosSheets();
      cargarUserId();
    };

    // Resetear credenciales
    const resetearCredenciales = () => {
      console.log('Resetting credentials');
      localStorage.removeItem('spreadsheetId');
      localStorage.removeItem('apiKey');
      localStorage.removeItem('clientId');
      localStorage.removeItem('accessToken');
      tempSpreadsheetId.value = '';
      tempApiKey.value = '';
      tempClientId.value = '';
      spreadsheetId.value = '';
      apiKey.value = '';
      clientId.value = '';
      accessToken.value = null;
      isSignedIn.value = false;
      window.googleAuthClient = null;
      mostrarModalCredenciales.value = true;
      console.log('Credentials and access token cleared, showing credentials modal');
    };

    // Generar o cargar userId
    const cargarUserId = () => {
      let savedUserId = localStorage.getItem('userId');
      if (!savedUserId) {
        savedUserId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', savedUserId);
      }
      userId.value = savedUserId;
      tempUserId.value = savedUserId;
      if (!savedUserId) {
        mostrarModalUserId.value = true;
      }
    };

    // Guardar userId y recargar progresos
    const guardarUserId = async () => {
      if (!tempUserId.value) {
        console.error('No userId provided');
        alert('Por favor, ingresa un ID de usuario.');
        return;
      }
      console.log('Changing userId to:', tempUserId.value);
      userId.value = tempUserId.value;
      localStorage.setItem('userId', userId.value);
      mostrarModalUserId.value = false;

      // Load progress for the new userId from Google Sheets
      await cargarProgresosDesdeSheets();

      // Overwrite localStorage with fetched data
      localStorage.setItem('progresos', JSON.stringify(progresos.value));
      localStorage.setItem('puntos', puntosTotales.value.toString());
      localStorage.setItem('insignias', JSON.stringify(insignias.value));
      console.log('localStorage updated with progress for userId:', userId.value);

      calcularPendientes();
      actualizarInsignias();
    };

    // Cargar datos de Google Sheets
    const cargarDatosSheets = async () => {
      try {
        console.log('Loading data from Google Sheets');
        const areasData = await fetchSheetData('Areas', 'A:D');
        areas.value = areasData.slice(1).map(row => ({
          id: parseInt(row[0]),
          nombre: row[1],
          color: row[2] || 'bg-gray-200',
          icono: row[3] || ''
        }));
        console.log('Areas loaded:', areas.value);

        const conocimientosData = await fetchSheetData('Conocimientos', 'A:C');
        conocimientos.value = conocimientosData.slice(1).map(row => ({
          id: parseInt(row[0]),
          areaId: parseInt(row[1]),
          nombre: row[2]
        }));
        console.log('Conocimientos loaded:', conocimientos.value);

        const temasData = await fetchSheetData('Temas', 'A:D');
        temas.value = temasData.slice(1).map(row => ({
          id: parseInt(row[0]),
          conocimientoId: parseInt(row[1]),
          nombre: row[2],
          imagen: row[3] || ''
        }));
        console.log('Temas loaded:', temas.value);

        ultimosTemas.value = [...temas.value].sort((a, b) => b.id - a.id).slice(0, 6);
        console.log('Ultimos temas loaded:', ultimosTemas.value);

        const preguntasData = await fetchSheetData('Preguntas', 'A:L');
        preguntas.value = preguntasData.slice(1).map(row => {
          let opciones = {};
          try { opciones = row[4] ? JSON.parse(row[4]) : {}; } catch (e) { console.warn('Error parsing opciones:', row[4]); }
          return {
            id: parseInt(row[0]),
            temaId: parseInt(row[1]),
            tipo: row[2],
            texto: row[3],
            opciones,
            correcta: row[5],
            elementos: row[7] ? row[7].split(',').map(s => s.trim()) : [],
            ordenCorrecto: row[8] ? row[8].split(',').map(s => parseInt(s.trim())) : [],
            textoBase: row[9],
            keywords: row[9] ? row[9].split(',').map(s => s.trim()) : [],
            explanation: row[6],
            imagen: row[10] || ''
          };
        });
        console.log('Preguntas loaded:', preguntas.value);
      } catch (error) {
        console.error('Error in cargarDatosSheets:', error);
        mostrarModalCredenciales.value = true;
      }
    };

    // Cargar progresos desde Google Sheets
    const cargarProgresosDesdeSheets = async () => {
      try {
        console.log('Fetching progresos for userId:', userId.value);
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId.value}/values/Progresos!A:G?key=${apiKey.value}&majorDimension=ROWS`
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Error fetching progresos: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        const rows = data.values || [];
        console.log('Rows fetched from Progresos tab:', rows);
        const userRows = rows.slice(1).filter(row => row[0] === userId.value);
        console.log('Filtered userRows for userId:', userRows);
        const existingIds = userRows.map(row => parseInt(row[1]));
        progresos.value = userRows.map(row => ({
          id: parseInt(row[1]),
          nivel: parseInt(row[2] || 1),
          ultimaRepaso: row[3] || new Date(0).toISOString(),
          aciertosConsecutivos: parseInt(row[4] || 0)
        }));
        puntosTotales.value = userRows.length > 0 ? parseInt(userRows[0][5] || 0) : 0;
        try {
          insignias.value = userRows.length > 0 && userRows[0][6] ? JSON.parse(userRows[0][6] || '[]') : [];
        } catch (e) {
          console.warn('Error parsing insignias for userId:', userId.value, e);
          insignias.value = [];
        }
        console.log('Progresos fetched:', progresos.value, 'Puntos:', puntosTotales.value, 'Insignias:', insignias.value);

        // Initialize progress for new questions
        const missingPreguntas = preguntas.value.filter(p => !existingIds.includes(p.id));
        if (missingPreguntas.length > 0) {
          console.log('Inicializando progresos para nuevas preguntas:', missingPreguntas.map(p => p.id));
          missingPreguntas.forEach(p => {
            progresos.value.push({
              id: p.id,
              nivel: 1,
              ultimaRepaso: new Date(0).toISOString(),
              aciertosConsecutivos: 0,
              pendiente: true
            });
          });
          await guardarProgresosEnSheets();
        }
      } catch (error) {
        console.error('Error loading progresos from Sheets:', error.message);
        progresos.value = preguntas.value.length > 0 ? preguntas.value.map(p => ({
          id: p.id,
          nivel: 1,
          ultimaRepaso: new Date(0).toISOString(),
          aciertosConsecutivos: 0,
          pendiente: true
        })) : [];
        puntosTotales.value = 0;
        insignias.value = [];
        localStorage.setItem('progresos', JSON.stringify(progresos.value));
        localStorage.setItem('puntos', puntosTotales.value.toString());
        localStorage.setItem('insignias', JSON.stringify(insignias.value));
        await guardarProgresosEnSheets();
      }
    };

    // Guardar progresos en Google Sheets
    const guardarProgresosEnSheets = async () => {
      if (!isSignedIn.value || !accessToken.value) {
        console.warn('User not signed in, showing auth modal');
        mostrarModalAuth.value = true;
        return;
      }
      try {
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId.value}/values/Progresos!A:G?key=${apiKey.value}&majorDimension=ROWS`
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Error fetching existing progresos: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        let rows = data.values || [['userId', 'preguntaId', 'nivel', 'ultimaRepaso', 'aciertosConsecutivos', 'puntosTotales', 'insignias']];
        const otherUsersRows = rows.slice(1).filter(row => row[0] !== userId.value);
        const userRows = progresos.value.map(progreso => [
          userId.value,
          progreso.id,
          progreso.nivel,
          progreso.ultimaRepaso,
          progreso.aciertosConsecutivos,
          puntosTotales.value,
          JSON.stringify(insignias.value)
        ]);
        const updatedRows = [
          ['userId', 'preguntaId', 'nivel', 'ultimaRepaso', 'aciertosConsecutivos', 'puntosTotales', 'insignias'],
          ...otherUsersRows,
          ...userRows
        ];
        console.log('Saving to Sheets:', {
          userId: userId.value,
          progresos: progresos.value,
          puntosTotales: puntosTotales.value,
          insignias: insignias.value
        });
        const updateResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId.value}/values/Progresos!A1:G${updatedRows.length}?valueInputOption=RAW`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken.value}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ values: updatedRows })
          }
        );
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Error saving progresos: ${updateResponse.status} ${errorText}`);
        }
        console.log('Progresos saved successfully');
      } catch (error) {
        console.error('Error saving progresos to Sheets:', error.message);
        localStorage.setItem('progresos', JSON.stringify(progresos.value));
        localStorage.setItem('puntos', puntosTotales.value.toString());
        localStorage.setItem('insignias', JSON.stringify(insignias.value));
        mostrarModalAuth.value = true;
      }
    };

    // Fetch datos de una hoja específica
    const fetchSheetData = async (sheetName, range = 'A:Z') => {
      if (!spreadsheetId.value || !apiKey.value) {
        console.error('Faltan credenciales de Google Sheets');
        return [];
      }
      try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId.value}/values/${encodeURIComponent(sheetName)}!${range}?key=${apiKey.value}&majorDimension=ROWS`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error fetching ${sheetName}: ${response.status}`);
        const data = await response.json();
        return data.values || [];
      } catch (error) {
        console.error(`Error loading ${sheetName}:`, error);
        return [];
      }
    };

    // Cargar datos iniciales
    const cargarCredenciales = async () => {
      console.log('Loading credentials from localStorage');
      const savedSpreadsheetId = localStorage.getItem('spreadsheetId');
      const savedApiKey = localStorage.getItem('apiKey');
      const savedClientId = localStorage.getItem('clientId');
      if (savedSpreadsheetId && savedApiKey && savedClientId) {
        tempSpreadsheetId.value = savedSpreadsheetId;
        tempApiKey.value = savedApiKey;
        tempClientId.value = savedClientId;
        spreadsheetId.value = savedSpreadsheetId;
        apiKey.value = savedApiKey;
        clientId.value = savedClientId;
        console.log('Credentials loaded:', { spreadsheetId: savedSpreadsheetId, apiKey: savedApiKey, clientId: savedClientId });
        const isValid = await validateCredentials();
        if (!isValid) {
          console.warn('Invalid credentials, showing credentials modal');
          mostrarModalCredenciales.value = true;
          return false;
        }
        await initGoogleAuth();
        return true;
      }
      console.warn('No credentials found, showing credentials modal');
      mostrarModalCredenciales.value = true;
      return false;
    };

    // Guardar progresos
    const guardarProgresos = async () => {
      await guardarProgresosEnSheets();
      localStorage.setItem('progresos', JSON.stringify(progresos.value));
      localStorage.setItem('puntos', puntosTotales.value.toString());
      localStorage.setItem('insignias', JSON.stringify(insignias.value));
    };

    // Calcular preguntas pendientes
    const calcularPendientes = () => {
      console.log('Calculating pending questions');
      if (!preguntas.value.length || !progresos.value.length) {
        console.log('No questions or progress loaded, initializing preguntasPendientes as empty');
        preguntasPendientes.value = [];
        return;
      }
      const hoy = new Date();
      progresos.value.forEach(prog => {
        const pregunta = preguntas.value.find(p => p.id === prog.id);
        if (!pregunta) return;
        const ultima = new Date(prog.ultimaRepaso);
        const proxima = new Date(ultima.getTime() + getIntervalo(prog.nivel));
        prog.pendiente = hoy >= proxima && prog.nivel < 10;
      });
      preguntasPendientes.value = progresos.value
        .filter(prog => prog.pendiente)
        .map(prog => preguntas.value.find(p => p.id === prog.id))
        .filter(Boolean);
      console.log('Preguntas pendientes:', preguntasPendientes.value);
    };

    // Intervalos de repaso
    const getIntervalo = (nivel) => {
      const intervalos = {
        1: 0,
        2: 1,
        3: 2,
        4: 7,
        5: 14,
        6: 30,
        7: 90,
        8: 180,
        9: 365
      };
      return (intervalos[nivel] || 0) * 24 * 60 * 60 * 1000;
    };

    // Iniciar cuestionario
    const iniciarCuestionario = (temaId) => {
      console.log('Iniciando cuestionario para tema:', temaId);
      temaSeleccionado.value = temaId;
      preguntasCuestionario.value = getPreguntasByTema(temaId);
      preguntaActualIndex.value = 1;
      vistaActual.value = 'cuestionario';
      cerrarModal();
      window.scrollTo(0, 0);
    };

    // Obtener respuesta del usuario en formato legible
    const getRespuestaUsuario = (pregunta, respuesta) => {
      if (!respuesta) return 'No respondida';
      if (pregunta.tipo === 'multiple') {
        return pregunta.opciones[respuesta] || 'Desconocida';
      } else if (pregunta.tipo === 'order') {
        if (typeof respuesta === 'string') {
          const indices = respuesta.split(',').map(i => parseInt(i.trim()) - 1);
          return indices.map(i => pregunta.elementos[i]).filter(e => e).join(', ');
        }
        return respuesta.join(', ');
      } else if (pregunta.tipo === 'keywords') {
        return respuesta;
      }
      return 'Desconocida';
    };

    // Obtener respuesta correcta en formato legible
    const getRespuestaCorrecta = (pregunta) => {
      if (pregunta.tipo === 'multiple') {
        return pregunta.opciones[pregunta.correcta];
      } else if (pregunta.tipo === 'order') {
        return pregunta.ordenCorrecto.map(idx => pregunta.elementos[idx]).join(', ');
      } else if (pregunta.tipo === 'keywords') {
        return pregunta.keywords.join(', ');
      }
      return 'Desconocida';
    };

    // Responder pregunta
    const responderPregunta = async (pregunta, respuestaUsuario) => {
      console.log('Respondiendo pregunta:', pregunta.id, 'con respuesta:', respuestaUsuario);
      preguntaActual.value = pregunta;
      respuestaUsuarioModal.value = respuestaUsuario;
      const prog = progresos.value.find(p => p.id === pregunta.id);
      if (!prog) {
        console.error('No se encontró progreso para la pregunta:', pregunta.id);
        progresos.value.push({
          id: pregunta.id,
          nivel: 1,
          ultimaRepaso: new Date(0).toISOString(),
          aciertosConsecutivos: 0,
          pendiente: true
        });
        await guardarProgresos();
        console.log('Progreso inicializado para pregunta:', pregunta.id);
        return;
      }
      let acierto = false;
      if (pregunta.tipo === 'multiple') {
        acierto = respuestaUsuario === pregunta.correcta;
      } else if (pregunta.tipo === 'order') {
        if (typeof respuestaUsuario === 'string') {
          const indices = respuestaUsuario.split(',').map(i => parseInt(i.trim()) - 1);
          const ordenUsuario = indices.map(i => pregunta.elementos[i]).filter(e => e);
          acierto = JSON.stringify(ordenUsuario) === JSON.stringify(pregunta.ordenCorrecto.map(idx => pregunta.elementos[idx]));
        } else {
          acierto = JSON.stringify(respuestaUsuario) === JSON.stringify(pregunta.ordenCorrecto.map(idx => pregunta.elementos[idx]));
        }
      } else if (pregunta.tipo === 'keywords') {
        const userKeywords = respuestaUsuario.toLowerCase().split(',').map(k => k.trim());
        acierto = pregunta.keywords.every(k => userKeywords.includes(k.toLowerCase())) && userKeywords.length === pregunta.keywords.length;
      }
      if (acierto) {
        prog.nivel = Math.min(prog.nivel + 1, 10);
        prog.aciertosConsecutivos++;
        modalEsCorrecto.value = true;
        modalNivel.value = prog.nivel;
        puntosTotales.value += 10;
        confetti({ particleCount: 100, spread: 70 });
        await guardarProgresos(); // Save only on correct answers
      } else {
        prog.nivel = 1;
        prog.aciertosConsecutivos = 0;
        modalEsCorrecto.value = false;
        modalNivel.value = 1;
      }
      prog.ultimaRepaso = new Date().toISOString();
      calcularPendientes();
      mostrarModal.value = true;
      respuestaSeleccionada[pregunta.id] = null;
      actualizarInsignias();
    };

    // Siguiente pregunta
    const siguientePregunta = () => {
      preguntaActualIndex.value++;
      cerrarModal();
      window.scrollTo(0, 0);
    };

    // Finalizar respuesta
    const finalizarRespuesta = async () => {
      if (vistaActual.value === 'cuestionario' && preguntaActualIndex.value >= preguntasCuestionario.value.length) {
        if (calcularProgresoTema(temaSeleccionado.value) === 100) {
          insignias.value.push('Maestro de ' + getTemaNombre(temaSeleccionado.value));
          await guardarProgresos();
        }
        vistaActual.value = 'explorar';
        temaSeleccionado.value = null;
        preguntaActualIndex.value = 0;
      }
      cerrarModal();
      window.scrollTo(0, 0);
    };

    // Cerrar modal
    const cerrarModal = () => {
      mostrarModal.value = false;
      preguntaActual.value = null;
      respuestaUsuarioModal.value = null;
    };

    // Componentes para tipos de preguntas
    const getComponentForType = (tipo) => {
      if (tipo === 'multiple') {
        return {
          props: ['pregunta'],
          template: `
            <div class="space-y-2">
              <label v-for="(opcion, key) in pregunta.opciones" :key="key" class="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                <input type="radio" v-model="$parent.respuestaSeleccionada[pregunta.id]" :value="key" class="mr-2 text-blue-500 focus:ring-blue-500">
                <span class="text-gray-700">{{ opcion }}</span>
              </label>
            </div>
          `
        };
      } else if (tipo === 'order') {
        if (window.VueDraggableNext && window.VueDraggableNext.draggable) {
          return {
            props: ['pregunta'],
            components: { draggable: window.VueDraggableNext.draggable },
            setup(props) {
              const lista = ref([...props.pregunta.elementos]);
              const onDragEnd = () => {
                props.pregunta && (respuestaSeleccionada[props.pregunta.id] = [...lista.value]);
              };
              return { lista, onDragEnd };
            },
            template: `
              <draggable v-model="lista" item-key="item" @end="onDragEnd" class="space-y-2">
                <template #item="{ element }">
                  <div class="p-3 bg-gray-50 rounded-lg cursor-move">{{ element }}</div>
                </template>
              </draggable>
            `
          };
        } else {
          return {
            props: ['pregunta'],
            setup(props) {
              const inputValue = ref('');
              const handleInput = (event) => {
                inputValue.value = event.target.value;
                props.pregunta && (respuestaSeleccionada[props.pregunta.id] = inputValue.value);
              };
              return { inputValue, handleInput };
            },
            template: `
              <div :key="pregunta.id">
                <p class="mb-2">Ingresa los números en el orden correcto (e.g., 1,2,3,4):</p>
                <ul class="mb-2">
                  <li v-for="(item, index) in pregunta.elementos" :key="index" class="text-gray-700">{{ index + 1 }}. {{ item }}</li>
                </ul>
                <input type="text" v-model="inputValue" @input="handleInput" placeholder="Ej: 1,2,3,4" class="w-full p-2 border rounded">
              </div>
            `
          };
        }
      } else if (tipo === 'keywords') {
        return {
          props: ['pregunta'],
          setup(props) {
            const inputValue = ref('');
            const handleInput = (event) => {
              inputValue.value = event.target.value;
              props.pregunta && (respuestaSeleccionada[pregunta.id] = inputValue.value);
            };
            return { inputValue, handleInput };
          },
          template: `
            <div :key="pregunta.id">
              <p class="mb-2">{{ pregunta.textoBase }}</p>
              <input type="text" v-model="inputValue" @input="handleInput" placeholder="Palabras clave separadas por coma" class="w-full p-2 border rounded">
            </div>
          `
        };
      }
      return { template: '<div>Tipo no soportado</div>' };
    };

    // Manejar respuesta
    const handleRespuesta = (respuesta, pregunta) => {
      respuestaSeleccionada[pregunta.id] = respuesta;
    };

    // Helpers para áreas y navegación
    const getAreaId = (temaId) => {
      const tema = temas.value.find(t => t.id === temaId);
      const conocimiento = conocimientos.value.find(c => c.id === tema?.conocimientoId);
      return conocimiento?.areaId || 1;
    };

    const getAreaNombre = (areaId) => {
      const area = areas.value.find(a => a.id === areaId);
      return area ? area.nombre : 'Desconocida';
    };

    const getAreaColor = (areaId) => {
      const area = areas.value.find(a => a.id === areaId);
      return area ? area.color : 'bg-gray-200';
    };

    const getNivel = (preguntaId) => {
      const prog = progresos.value.find(p => p.id === preguntaId);
      return prog ? prog.nivel : 1;
    };

    const getConocimientosByArea = (areaId) => {
      return conocimientos.value.filter(c => c.areaId === areaId);
    };

    const getTemasByConocimiento = (conocimientoId) => {
      return temas.value.filter(t => t.conocimientoId === conocimientoId);
    };

    const getPreguntasByTema = (temaId) => {
      return preguntas.value.filter(p => p.temaId === temaId);
    };

    const getTemaNombre = (temaId) => {
      const tema = temas.value.find(t => t.id === temaId);
      return tema ? tema.nombre : 'Desconocido';
    };

    const getTemaImagen = (temaId) => {
      const tema = temas.value.find(t => t.id === temaId);
      return tema ? tema.imagen : '';
    };

    const calcularProgresoTema = (temaId) => {
      const preguntasTema = getPreguntasByTema(temaId);
      const total = preguntasTema.length;
      const aprendidas = progresos.value.filter(p => preguntasTema.some(q => q.id === p.id) && p.nivel >= 10).length;
      return total > 0 ? Math.round((aprendidas / total) * 100) : 0;
    };

    const getPreguntaTexto = (preguntaId) => {
      const pregunta = preguntas.value.find(p => p.id === preguntaId);
      return pregunta ? pregunta.texto : 'Desconocida';
    };

    const getPreguntaTemaId = (preguntaId) => {
      const pregunta = preguntas.value.find(p => p.id === preguntaId);
      return pregunta ? pregunta.temaId : null;
    };

    // Estadísticas
    const contarPreguntasArea = (areaId) => {
      const conocs = getConocimientosByArea(areaId);
      const temasArea = temas.value.filter(t => conocs.some(c => c.id === t.conocimientoId));
      return preguntas.value.filter(p => temasArea.some(t => t.id === p.temaId)).length;
    };

    const contarAprendidasArea = (areaId) => {
      const conocs = getConocimientosByArea(areaId);
      const temasArea = temas.value.filter(t => conocs.some(c => c.id === t.conocimientoId));
      const pregIds = preguntas.value.filter(p => temasArea.some(t => t.id === p.temaId)).map(p => p.id);
      return progresos.value.filter(p => pregIds.includes(p.id) && p.nivel >= 10).length;
    };

    const calcularProgresoArea = (areaId) => {
      const total = contarPreguntasArea(areaId);
      const aprendidas = contarAprendidasArea(areaId);
      return total > 0 ? Math.round((aprendidas / total) * 100) : 0;
    };

    const actualizarInsignias = () => {
      temas.value.forEach(tema => {
        if (calcularProgresoTema(tema.id) === 100 && !insignias.value.includes('Maestro de ' + tema.nombre)) {
          insignias.value.push('Maestro de ' + tema.nombre);
          guardarProgresos();
        }
      });
    };

    // Resetear progresos
    const confirmarReset = async () => {
      console.log('Confirming reset of progress');
      progresos.value = preguntas.value.map(p => ({
        id: p.id,
        nivel: 1,
        ultimaRepaso: new Date(0).toISOString(),
        aciertosConsecutivos: 0,
        pendiente: true
      }));
      puntosTotales.value = 0;
      insignias.value = [];
      await guardarProgresos();
      calcularPendientes();
      mostrarModalReset.value = false;
      window.scrollTo(0, 0);
    };

    const toggleExpand = (tipo, id) => {
      expanded.value[tipo][id] = !expanded.value[tipo][id];
    };

    // Cargar datos iniciales
    onMounted(async () => {
      console.log('onMounted triggered');
      mostrarModalReset.value = false;
      mostrarModal.value = false; // Reset feedback modal
      preguntaActual.value = null; // Reset current question
      respuestaUsuarioModal.value = null; // Reset user response
      Object.keys(respuestaSeleccionada).forEach(key => {
        respuestaSeleccionada[key] = null; // Reset selected answers
      });
      try {
        if (await cargarCredenciales()) {
          await cargarDatosSheets();
          await cargarProgresosDesdeSheets();
          calcularPendientes();
          actualizarInsignias();
        }
      } catch (error) {
        console.error('Error in onMounted:', error);
        mostrarModalCredenciales.value = true;
      }
      window.scrollTo(0, 0);
    });

    return {
      areas,
      conocimientos,
      temas,
      ultimosTemas,
      preguntas,
      progresos,
      preguntasPendientes,
      respuestaSeleccionada,
      respuestaUsuarioModal,
      mostrarModal,
      modalEsCorrecto,
      modalNivel,
      mostrarModalReset,
      puntosTotales,
      insignias,
      preguntaActual,
      mostrarModalCredenciales,
      tempSpreadsheetId,
      tempApiKey,
      tempClientId,
      spreadsheetId,
      apiKey,
      clientId,
      mostrarModalAuth,
      isSignedIn,
      accessToken,
      userId,
      tempUserId,
      mostrarModalUserId,
      vistaActual,
      expanded,
      temaSeleccionado,
      preguntaActualIndex,
      preguntasCuestionario,
      toggleExpand,
      iniciarCuestionario,
      responderPregunta,
      siguientePregunta,
      finalizarRespuesta,
      cerrarModal,
      confirmarReset,
      resetearCredenciales,
      guardarCredenciales,
      guardarUserId,
      iniciarSesionGoogle,
      cerrarModalAuth,
      calcularProgresoArea,
      contarAprendidasArea,
      contarPreguntasArea,
      calcularProgresoTema,
      getAreaId,
      getAreaNombre,
      getAreaColor,
      getNivel,
      getConocimientosByArea,
      getTemasByConocimiento,
      getPreguntasByTema,
      getTemaNombre,
      getTemaImagen,
      getPreguntaTexto,
      getPreguntaTemaId,
      getComponentForType,
      handleRespuesta,
      getRespuestaUsuario,
      getRespuestaCorrecta,
      handleImageError
    };
  }
}).mount('#app');
