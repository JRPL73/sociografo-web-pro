import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  HelpCircle, 
  UserPlus, 
  PlusCircle, 
  Play, 
  Download, 
  Trash2, 
  UserCheck, 
  ChevronRight,
  Info
} from 'lucide-react';

const App = () => {
  // --- ESTADOS DE LA APLICACIÓN ---
  const [activeTab, setActiveTab] = useState('config'); // config, respuestas, resultado
  const [alumnos, setAlumnos] = useState([]);
  const [nuevoAlumno, setNuevoAlumno] = useState("");
  const [preguntas, setPreguntas] = useState([
    { id: 1, texto: "¿Con quién te gustaría trabajar?", tipo: "AFINIDAD" },
    { id: 2, texto: "¿Con quién NO te gustaría trabajar?", tipo: "RECHAZO" }
  ]);
  const [nuevaPregunta, setNuevaPregunta] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState("AFINIDAD");
  const [respuestas, setRespuestas] = useState([]); // Array de { de, para, preguntaId }
  
  // Nuevos estados para la selección en columnas
  const [registroDe, setRegistroDe] = useState("");
  const [registroPara, setRegistroPara] = useState("");
  const [registroPregunta, setRegistroPregunta] = useState("");
  const [busquedaAlumno, setBusquedaAlumno] = useState("");

  const canvasRef = useRef(null);

  // Inicializar la pregunta seleccionada por defecto
  useEffect(() => {
    if (preguntas.length > 0 && !registroPregunta) {
      setRegistroPregunta(preguntas[0].id);
    }
  }, [preguntas, registroPregunta]);

  // --- LÓGICA DE GESTIÓN ---
  const agregarAlumno = () => {
    if (nuevoAlumno.trim() && !alumnos.includes(nuevoAlumno.trim())) {
      setAlumnos([...alumnos, nuevoAlumno.trim()]);
      setNuevoAlumno("");
    }
  };

  const agregarPregunta = () => {
    if (nuevaPregunta.trim()) {
      setPreguntas([...preguntas, { 
        id: Date.now(), 
        texto: nuevaPregunta.trim(), 
        tipo: nuevoTipo 
      }]);
      setNuevaPregunta("");
    }
  };

  const eliminarAlumno = (nombre) => {
    setAlumnos(alumnos.filter(a => a !== nombre));
    setRespuestas(respuestas.filter(r => r.de !== nombre && r.para !== nombre));
  };

  const registrarVoto = (de, para, preguntaId) => {
    if (de === para) return;
    // Evitar duplicados para la misma pregunta
    const existe = respuestas.find(r => r.de === de && r.para === para && r.preguntaId === preguntaId);
    if (!existe) {
      setRespuestas([...respuestas, { de, para, preguntaId }]);
    }
  };

  const borrarRespuesta = (index) => {
    const nuevas = [...respuestas];
    nuevas.splice(index, 1);
    setRespuestas(nuevas);
  };

  // --- MOTOR DEL GRAFO (Física Simple para evitar solapamientos) ---
  useEffect(() => {
    if (activeTab === 'resultado' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const width = canvas.width = canvas.offsetWidth;
      const height = canvas.height = canvas.offsetHeight;

      // Inicializar posiciones aleatorias
      let nodes = alumnos.map(nombre => ({
        id: nombre,
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
        radius: 35,
        isFixed: false // Propiedad para saber si el usuario lo ha fijado
      }));

      const links = respuestas.map(r => {
        const p = preguntas.find(preg => preg.id === r.preguntaId);
        return {
          source: nodes.find(n => n.id === r.de),
          target: nodes.find(n => n.id === r.para),
          color: p?.tipo === "AFINIDAD" ? "#10b981" : "#ef4444"
        };
      });

      // Calcular número de afinidades y rechazos RECIBIDOS por cada nodo
      nodes.forEach(n => {
        n.inAffinities = links.filter(l => l.target === n && l.color === "#10b981").length;
        n.inRejections = links.filter(l => l.target === n && l.color === "#ef4444").length;
      });

      let draggingNode = null;

      const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
          x: clientX - rect.left,
          y: clientY - rect.top
        };
      };

      const handleStart = (e) => {
        const pos = getPos(e);
        // Buscar desde arriba hacia abajo por si se solapan
        for (let i = nodes.length - 1; i >= 0; i--) {
          const n = nodes[i];
          const dx = pos.x - n.x;
          const dy = pos.y - n.y;
          if (dx * dx + dy * dy < n.radius * n.radius) {
            draggingNode = n;
            n.isFixed = true; // Al moverlo, queda fijado
            break;
          }
        }
      };

      const handleMove = (e) => {
        if (draggingNode) {
          if (e.touches) e.preventDefault(); // Evitar scroll en móvil al arrastrar
          const pos = getPos(e);
          draggingNode.x = pos.x;
          draggingNode.y = pos.y;
        }
      };

      const handleEnd = () => {
        draggingNode = null;
      };

      canvas.addEventListener('mousedown', handleStart);
      canvas.addEventListener('mousemove', handleMove);
      canvas.addEventListener('mouseup', handleEnd);
      canvas.addEventListener('mouseleave', handleEnd);
      canvas.addEventListener('touchstart', handleStart, { passive: false });
      canvas.addEventListener('touchmove', handleMove, { passive: false });
      canvas.addEventListener('touchend', handleEnd);

      // Simulación de física (Fruchterman-Reingold simplificado)
      const animate = () => {
        // 1. Repulsión (para que no se toquen)
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            let dx = nodes[i].x - nodes[j].x;
            let dy = nodes[i].y - nodes[j].y;
            let distance = Math.sqrt(dx * dx + dy * dy) || 1;
            let force = (nodes[i].radius + nodes[j].radius + 50) / (distance * distance) * 200;
            let fx = (dx / distance) * force;
            let fy = (dy / distance) * force;
            nodes[i].vx += fx;
            nodes[i].vy += fy;
            nodes[j].vx -= fx;
            nodes[j].vy -= fy;
          }
        }

        // 2. Atracción (las relaciones los juntan)
        links.forEach(l => {
          let dx = l.target.x - l.source.x;
          let dy = l.target.y - l.source.y;
          let distance = Math.sqrt(dx * dx + dy * dy) || 1;
          let force = (distance - 150) * 0.02;
          let fx = (dx / distance) * force;
          let fy = (dy / distance) * force;
          l.source.vx += fx;
          l.source.vy += fy;
          l.target.vx -= fx;
          l.target.vy -= fy;
        });

        // 3. Gravedad al centro y actualización
        nodes.forEach(n => {
          if (!n.isFixed && n !== draggingNode) {
            n.vx += (width / 2 - n.x) * 0.01;
            n.vy += (height / 2 - n.y) * 0.01;
            
            // Aplicar velocidad
            n.x += n.vx;
            n.y += n.vy;
          } else {
            // Si está fijo o siendo arrastrado, detener su inercia
            n.vx = 0;
            n.vy = 0;
          }
          
          // Fricción
          n.vx *= 0.8;
          n.vy *= 0.8;

          // Límites de pantalla
          n.x = Math.max(n.radius, Math.min(width - n.radius, n.x));
          n.y = Math.max(n.radius, Math.min(height - n.radius, n.y));
        });

        // Dibujar
        ctx.clearRect(0, 0, width, height);

        // Dibujar flechas
        links.forEach(l => {
          const angle = Math.atan2(l.target.y - l.source.y, l.target.x - l.source.x);
          
          // Detener la línea en el borde del círculo (radio 35 + margen de 3)
          const radiusOffset = 38;
          
          const dx = l.target.x - l.source.x;
          const dy = l.target.y - l.source.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // No dibujar si están demasiado cerca (evita errores gráficos)
          if (distance < radiusOffset * 2) return;

          const startX = l.source.x + radiusOffset * Math.cos(angle);
          const startY = l.source.y + radiusOffset * Math.sin(angle);
          const endX = l.target.x - radiusOffset * Math.cos(angle);
          const endY = l.target.y - radiusOffset * Math.sin(angle);

          // Punto de control para curva cuadrática (para evitar superposición bidireccional)
          const curveOffset = 30;
          const midX = (startX + endX) / 2 - curveOffset * Math.sin(angle);
          const midY = (startY + endY) / 2 + curveOffset * Math.cos(angle);

          ctx.beginPath();
          // Diferenciar visualmente rechazo (discontinuo) y afinidad (continuo)
          if (l.color === "#ef4444") {
            ctx.setLineDash([5, 5]);
          } else {
            ctx.setLineDash([]);
          }
          
          ctx.strokeStyle = l.color;
          ctx.lineWidth = 2.5;
          ctx.moveTo(startX, startY);
          ctx.quadraticCurveTo(midX, midY, endX, endY);
          ctx.stroke();
          
          ctx.setLineDash([]); // Reset para la flecha

          // Calcular ángulo en el punto de llegada para dibujar la cabeza de la flecha
          const headAngle = Math.atan2(endY - midY, endX - midX);

          // Cabeza de flecha
          ctx.beginPath();
          ctx.fillStyle = l.color;
          ctx.moveTo(
            endX - 15 * Math.cos(headAngle - Math.PI / 6),
            endY - 15 * Math.sin(headAngle - Math.PI / 6)
          );
          ctx.lineTo(endX, endY);
          ctx.lineTo(
            endX - 15 * Math.cos(headAngle + Math.PI / 6),
            endY - 15 * Math.sin(headAngle + Math.PI / 6)
          );
          ctx.fill();
        });

        // Dibujar Nodos
        nodes.forEach(n => {
          ctx.beginPath();
          ctx.arc(n.x, n.y, 35, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          // Borde distinto si el usuario lo ha fijado
          ctx.strokeStyle = n.isFixed ? "#8b5cf6" : "#3b82f6";
          ctx.lineWidth = n.isFixed ? 4 : 3;
          ctx.stroke();

          // Nombre del alumno
          ctx.fillStyle = "#1e293b";
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(n.id, n.x, n.y - 4);

          // Contadores de votos (+ y -)
          ctx.font = "bold 11px sans-serif";
          ctx.fillStyle = "#10b981"; // Verde
          ctx.fillText(`+${n.inAffinities}`, n.x - 12, n.y + 12);
          
          ctx.fillStyle = "#cbd5e1"; // Separador
          ctx.fillText(`|`, n.x, n.y + 12);

          ctx.fillStyle = "#ef4444"; // Rojo
          ctx.fillText(`-${n.inRejections}`, n.x + 12, n.y + 12);
        });

        if (activeTab === 'resultado') requestAnimationFrame(animate);
      };

      const animationId = requestAnimationFrame(animate);
      
      // Limpieza de eventos al desmontar
      return () => {
        cancelAnimationFrame(animationId);
        canvas.removeEventListener('mousedown', handleStart);
        canvas.removeEventListener('mousemove', handleMove);
        canvas.removeEventListener('mouseup', handleEnd);
        canvas.removeEventListener('mouseleave', handleEnd);
        canvas.removeEventListener('touchstart', handleStart);
        canvas.removeEventListener('touchmove', handleMove);
        canvas.removeEventListener('touchend', handleEnd);
      };
    }
  }, [activeTab, alumnos, respuestas, preguntas]);

  const descargarImagen = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'sociograma.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  const alumnosFiltrados = alumnos.filter(a => a.toLowerCase().includes(busquedaAlumno.toLowerCase()));
  const filasDeAlumnos = [];
  for (let i = 0; i < alumnosFiltrados.length; i += 3) {
    filasDeAlumnos.push(alumnosFiltrados.slice(i, i + 3));
  }
  // Forzar al menos 9 filas para cumplir con la estructura de tabla solicitada
  while (filasDeAlumnos.length < 9) {
    filasDeAlumnos.push([]);
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* HEADER */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">SocioGrafo Web Pro</h1>
            <p className="text-xs text-slate-500">Gestión de relaciones escolares</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeTab === 'config' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
          >
            1. Configurar
          </button>
          <button 
            onClick={() => setActiveTab('respuestas')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeTab === 'respuestas' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
          >
            2. Respuestas
          </button>
          <button 
            onClick={() => setActiveTab('resultado')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${activeTab === 'resultado' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
          >
            3. Sociograma
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        
        {/* PANEL DE CONFIGURACIÓN */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Alumnos */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4 text-blue-600">
                <UserPlus size={20} />
                <h2 className="font-bold text-lg">Lista de Alumnos</h2>
              </div>
              <div className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  value={nuevoAlumno}
                  onChange={(e) => setNuevoAlumno(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && agregarAlumno()}
                  placeholder="Ej: Ana García" 
                  className="flex-1 border rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-400 outline-none"
                />
                <button onClick={agregarAlumno} className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition">
                  Añadir
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alumnos.map(a => (
                  <div key={a} className="flex justify-between items-center bg-slate-50 px-4 py-2 rounded-lg group">
                    <span className="font-medium text-slate-700">{a}</span>
                    <button onClick={() => eliminarAlumno(a)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {alumnos.length === 0 && <p className="text-slate-400 text-center py-4 italic">No hay alumnos todavía.</p>}
              </div>
            </div>

            {/* Preguntas */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border">
              <div className="flex items-center gap-2 mb-4 text-purple-600">
                <HelpCircle size={20} />
                <h2 className="font-bold text-lg">Preguntas del Test</h2>
              </div>
              <div className="space-y-3 mb-4">
                <input 
                  type="text" 
                  value={nuevaPregunta}
                  onChange={(e) => setNuevaPregunta(e.target.value)}
                  placeholder="Ej: ¿Con quién te gusta salir al recreo?" 
                  className="w-full border rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-400 outline-none"
                />
                <div className="flex gap-2">
                  <select 
                    value={nuevoTipo}
                    onChange={(e) => setNuevoTipo(e.target.value)}
                    className="flex-1 border rounded-xl px-4 py-2 bg-white"
                  >
                    <option value="AFINIDAD">Elección Positiva (Afinidad)</option>
                    <option value="RECHAZO">Elección Negativa (Rechazo)</option>
                  </select>
                  <button onClick={agregarPregunta} className="bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition">
                    Añadir
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {preguntas.map(p => (
                  <div key={p.id} className="p-3 border rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold">{p.texto}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${p.tipo === 'AFINIDAD' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.tipo}
                      </span>
                    </div>
                    <button onClick={() => setPreguntas(preguntas.filter(x => x.id !== p.id))} className="text-slate-300 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PANEL DE RESPUESTAS */}
        {activeTab === 'respuestas' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-6 rounded-2xl shadow-sm border mb-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex items-center gap-2 text-green-600">
                  <UserCheck size={20} />
                  <h2 className="font-bold text-lg">Registrar Datos</h2>
                </div>
                {/* Buscador de alumnos */}
                <div className="w-full md:w-auto">
                  <input 
                    type="text"
                    placeholder="Buscar alumno..."
                    value={busquedaAlumno}
                    onChange={(e) => setBusquedaAlumno(e.target.value)}
                    className="w-full md:w-64 border rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-400 outline-none"
                  />
                </div>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300">
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 mb-2">1. SELECCIONA LA PREGUNTA</label>
                  <select 
                    value={registroPregunta}
                    onChange={(e) => setRegistroPregunta(Number(e.target.value))}
                    className="w-full md:w-1/2 border rounded-lg px-3 py-2 bg-white"
                  >
                    {preguntas.map(p => <option key={p.id} value={p.id}>{p.texto}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Columna Origen */}
                  <div className="bg-white border rounded-xl overflow-hidden flex flex-col h-[400px] shadow-sm">
                    <div className="bg-slate-100 p-3 text-xs font-bold text-slate-600 text-center border-b">
                      2. EL ALUMNO...
                    </div>
                    <div className="overflow-y-auto flex-1">
                      <table className="w-full text-left border-collapse table-fixed">
                        <tbody>
                          {alumnos.length === 0 ? (
                            <tr><td className="text-xs text-slate-400 text-center p-4">Añade alumnos en Configurar</td></tr>
                          ) : (
                            filasDeAlumnos.map((fila, i) => (
                              <tr key={i} className="border-b last:border-0 h-10">
                                {[0, 1, 2].map((colIndex) => {
                                  const a = fila[colIndex];
                                  return (
                                    <td 
                                      key={colIndex}
                                      onClick={() => a && setRegistroDe(a)}
                                      className={`border-r last:border-r-0 px-2 py-1 text-xs sm:text-sm text-center truncate transition-colors ${
                                        !a ? 'bg-slate-50/30 cursor-default' : 
                                        registroDe === a ? 'bg-blue-100 text-blue-700 font-bold cursor-pointer' : 
                                        'hover:bg-slate-50 text-slate-700 cursor-pointer'
                                      }`}
                                    >
                                      {a || ""}
                                    </td>
                                  )
                                })}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Columna Destino */}
                  <div className="bg-white border rounded-xl overflow-hidden flex flex-col h-[400px] shadow-sm">
                    <div className="bg-slate-100 p-3 text-xs font-bold text-slate-600 text-center border-b">
                      3. ELIGIÓ A...
                    </div>
                    <div className="overflow-y-auto flex-1">
                      <table className="w-full text-left border-collapse table-fixed">
                        <tbody>
                          {alumnos.length === 0 ? (
                            <tr><td className="text-xs text-slate-400 text-center p-4">Añade alumnos en Configurar</td></tr>
                          ) : (
                            filasDeAlumnos.map((fila, i) => (
                              <tr key={i} className="border-b last:border-0 h-10">
                                {[0, 1, 2].map((colIndex) => {
                                  const a = fila[colIndex];
                                  return (
                                    <td 
                                      key={colIndex}
                                      onClick={() => a && setRegistroPara(a)}
                                      className={`border-r last:border-r-0 px-2 py-1 text-xs sm:text-sm text-center truncate transition-colors ${
                                        !a ? 'bg-slate-50/30 cursor-default' : 
                                        registroPara === a ? 'bg-blue-100 text-blue-700 font-bold cursor-pointer' : 
                                        'hover:bg-slate-50 text-slate-700 cursor-pointer'
                                      }`}
                                    >
                                      {a || ""}
                                    </td>
                                  )
                                })}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button 
                    onClick={() => {
                      if (registroDe && registroPara && registroPregunta) {
                        registrarVoto(registroDe, registroPara, registroPregunta);
                        // Limpiamos solo "Para" para facilitar el ingreso de votos continuos de un mismo alumno
                        setRegistroPara(""); 
                      }
                    }}
                    disabled={!registroDe || !registroPara || !registroPregunta || registroDe === registroPara}
                    className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition"
                  >
                    <PlusCircle size={20} /> Registrar Voto
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Alumno Origen</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase text-center">Relación</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Alumno Destino</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase">Pregunta</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {respuestas
                    .map((r, idx) => ({ ...r, originalIndex: idx }))
                    .reverse()
                    .map((r) => {
                    const p = preguntas.find(x => x.id === r.preguntaId);
                    return (
                      <tr key={r.originalIndex} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 font-medium">{r.de}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block w-8 h-0.5 align-middle ${p?.tipo === 'AFINIDAD' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          <ChevronRight size={14} className={`inline ${p?.tipo === 'AFINIDAD' ? 'text-green-500' : 'text-red-500'}`} />
                        </td>
                        <td className="px-6 py-4 font-medium">{r.para}</td>
                        <td className="px-6 py-4 text-xs text-slate-500 italic">{p?.texto}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => borrarRespuesta(r.originalIndex)} className="text-slate-300 hover:text-red-500">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {respuestas.length === 0 && (
                <div className="p-12 text-center text-slate-400">
                  <Info className="mx-auto mb-2 opacity-20" size={48} />
                  <p>No has registrado ninguna respuesta todavía.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANEL DE RESULTADO (GRAFO) */}
        {activeTab === 'resultado' && (
          <div className="animate-in zoom-in-95 duration-500">
            <div className="bg-white p-4 rounded-2xl shadow-xl border overflow-hidden relative group">
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <button 
                  onClick={descargarImagen}
                  className="bg-orange-500 text-white p-3 rounded-xl shadow-lg hover:bg-orange-600 transition flex items-center gap-2 font-bold"
                >
                  <Download size={20} /> Exportar Imagen
                </button>
              </div>
              
              <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur border rounded-lg p-3 text-[10px] uppercase font-bold text-slate-500 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div> Afinidad
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div> Rechazo
                </div>
                <div className="pt-2 text-[10px] text-slate-600 normal-case leading-snug font-medium">
                  • <span className="font-bold text-purple-600">Arrastra un nodo</span> para fijarlo en su posición.<br/>
                  • Los números (<span className="text-green-600">+</span> | <span className="text-red-500">-</span>) son votos recibidos.
                </div>
              </div>

              <canvas 
                ref={canvasRef} 
                className="w-full h-[600px] cursor-move"
              />
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-8 text-center text-slate-400 text-sm">
        SocioGrafo Web &bull; Herramienta de Análisis Grupal &bull; 2024
      </footer>
    </div>
  );
};

export default App;
