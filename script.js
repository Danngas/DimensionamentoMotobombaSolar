// Carregar dados das bombas
async function carregarBombas() {
  try {
    const response = await fetch('bombas.json');
    if (!response.ok) throw new Error('Erro ao carregar bombas.json');
    return await response.json();
  } catch (error) {
    console.error(error);
    alert('Erro ao carregar os dados das bombas. Verifique o arquivo bombas.json.');
    return [];
  }
}

// Configuração do gráfico
let chartInstance = null;
function criarGrafico(vazaoM3h, mca, bombas) {
  const ctx = document.getElementById('curvas-bombas').getContext('2d');
  if (chartInstance) {
    chartInstance.destroy();
  }

  const chartConfig = {
    type: 'line',
    data: {
      datasets: [
        ...bombas.map((bomba, index) => ({
          label: `${bomba.modelo} (${bomba.potencia})`,
          data: bomba.dados.map(d => ({ x: d.vazao, y: d.altura })),
          borderColor: [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5'
          ][index],
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4
        })),
        {
          label: 'Ponto de Operação',
          data: [{ x: vazaoM3h, y: mca }],
          backgroundColor: '#FF0000',
          borderColor: '#FF0000',
          pointRadius: 6,
          pointHoverRadius: 8,
          showLine: false
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Vazão (m³/h)' },
          min: 0,
          max: 12,
          ticks: { stepSize: 1 }
        },
        y: {
          title: { display: true, text: 'Altura (m)' },
          min: 0,
          max: 250,
          ticks: { stepSize: 50 }
        }
      },
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: { enabled: true }
      }
    }
  };

  chartInstance = new Chart(ctx, chartConfig);
}

// Função para interpolar altura com base na vazão
function interpolarAltura(dados, vazaoDesejada) {
  const sortedDados = dados.sort((a, b) => a.vazao - b.vazao);
  if (vazaoDesejada <= sortedDados[0].vazao) return sortedDados[0].altura;
  if (vazaoDesejada >= sortedDados[sortedDados.length - 1].vazao) return sortedDados[sortedDados.length - 1].altura;

  for (let i = 0; i < sortedDados.length - 1; i++) {
    if (vazaoDesejada >= sortedDados[i].vazao && vazaoDesejada <= sortedDados[i + 1].vazao) {
      const x0 = sortedDados[i].vazao;
      const y0 = sortedDados[i].altura;
      const x1 = sortedDados[i + 1].vazao;
      const y1 = sortedDados[i + 1].altura;
      return y0 + (y1 - y0) * (vazaoDesejada - x0) / (x1 - x0);
    }
  }
  return 0;
}

// Função para selecionar bomba adequada
function selecionarBomba(vazaoM3h, mca, bombas) {
  let bombaSelecionada = null;
  for (const bomba of bombas) {
    const altura = interpolarAltura(bomba.dados, vazaoM3h);
    if (altura >= mca) {
      bombaSelecionada = bomba;
      break;
    }
  }
  return bombaSelecionada ? `${bombaSelecionada.modelo}, ${bombaSelecionada.potencia}` : "Nenhum modelo encontrado";
}

// Inicializar o formulário
async function inicializar() {
  const bombas = await carregarBombas();
  if (bombas.length === 0) return;

  const vazaoInput = document.getElementById('vazao');
  const unidadeVazaoSelect = document.getElementById('unidade-vazao');
  const hspContainer = document.getElementById('hsp-container');

  function atualizarPlaceholder() {
    const unidade = unidadeVazaoSelect.value;
    if (unidade === 'm3_hora') {
      vazaoInput.placeholder = 'Metros Cúbicos por Hora';
    } else if (unidade === 'l_dia') {
      vazaoInput.placeholder = 'Litros por Dia';
    } else if (unidade === 'l_hora') {
      vazaoInput.placeholder = 'Litros por Hora';
    }
  }

  atualizarPlaceholder();

  unidadeVazaoSelect.addEventListener('change', function() {
    atualizarPlaceholder();
    if (this.value === 'l_dia') {
      hspContainer.classList.remove('hidden');
      document.getElementById('hsp').setAttribute('required', 'true');
    } else {
      hspContainer.classList.add('hidden');
      document.getElementById('hsp').removeAttribute('required');
    }
  });

  document.getElementById('dimensionamento-form').addEventListener('submit', function(event) {
    event.preventDefault();

    // Capturar entradas
    const h1 = parseFloat(document.getElementById('h1').value);
    const h2 = parseFloat(document.getElementById('h2').value);
    const distancia = parseFloat(document.getElementById('distancia').value);
    let vazao = parseFloat(document.getElementById('vazao').value);
    const unidadeVazao = document.getElementById('unidade-vazao').value;
    const hsp = parseFloat(document.getElementById('hsp').value) || 0;
    const kPerdas = parseFloat(document.getElementById('k_perdas').value);

    // Validar entradas
    if (isNaN(h1) || isNaN(h2) || isNaN(distancia) || isNaN(vazao) || isNaN(kPerdas)) {
      alert('Por favor, preencha todos os campos com valores numéricos válidos.');
      return;
    }
    if (unidadeVazao === 'l_dia' && hsp <= 0) {
      alert('Por favor, insira um valor válido para Horas de Sol Pleno (h).');
      return;
    }

    // Converter vazão para m³/h
    let vazaoM3h;
    if (unidadeVazao === 'l_dia') {
      vazaoM3h = (vazao / hsp) / 1000;
    } else if (unidadeVazao === 'l_hora') {
      vazaoM3h = vazao / 1000;
    } else {
      vazaoM3h = vazao;
    }

    // Calcular MCA
    const distanciaTotal = h1 + h2 + distancia;
    const mca = h1 + h2 + distanciaTotal * kPerdas;

    // Selecionar bomba
    const bombaRecomendada = selecionarBomba(vazaoM3h, mca, bombas);

    // Exibir resultados
    document.getElementById('vazao-m3h').innerHTML = `Vazão Calculada: <span>${vazaoM3h.toFixed(2)}</span> m³/h`;
    document.getElementById('mca').innerHTML = `Altura Manométrica Total (MCA): <span>${mca.toFixed(2)}</span> m`;
    document.getElementById('bomba-recomendada').innerHTML = `Modelo de Bomba Recomendado: <span>${bombaRecomendada}</span>`;

    // Criar gráfico
    criarGrafico(vazaoM3h, mca, bombas);
  });
}

// Iniciar a aplicação
inicializar();