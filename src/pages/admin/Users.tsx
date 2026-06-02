import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, setDoc, writeBatch, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { gamificationService } from '../../services/gamificationService';
import { UserProfile, Role, Area, Country, Project } from '../../types';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { toast } from 'sonner';
import { Users as UsersIcon, Shield, CheckCircle2, XCircle, Search, Filter, Upload, Loader2, AlertCircle, Trash2, RotateCcw, Plus, Award, User, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Users() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isCleanConfirmOpen, setIsCleanConfirmOpen] = useState(false);
  const [duplicateGroupsToClean, setDuplicateGroupsToClean] = useState<UserProfile[][]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetPointsModalOpen, setIsResetPointsModalOpen] = useState(false);
  const [isDeleteOnboardingPointsModalOpen, setIsDeleteOnboardingPointsModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [userToReset, setUserToReset] = useState<UserProfile | null>(null);
  const [userToDeleteOnboardingPoints, setUserToDeleteOnboardingPoints] = useState<UserProfile | null>(null);
  const [resetOptions, setResetOptions] = useState({
    points: true,
    weeklyPoints: true,
    level: true,
    badges: true,
    studyTime: false,
    quizProgress: false
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeletingOnboardingPoints, setIsDeletingOnboardingPoints] = useState(false);
  const [adjustmentMode, setAdjustmentMode] = useState<'reset' | 'decrease'>('reset');
  const [adjustmentValues, setAdjustmentValues] = useState({
    points: 0,
    studyTimeMinutes: 0
  });
  const [bulkData, setBulkData] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: number, total: number } | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');
  const [selectedOnboardingJourney, setSelectedOnboardingJourney] = useState<string>('standard');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [newUserFormData, setNewUserFormData] = useState({
    name: '',
    email: '',
    roleId: '',
    areaId: '',
    jobTitle: '',
    leaderName: '',
    leaderEmail: '',
    country: '',
    countryId: ''
  });

  const BRAZIL_BASE_RAW = `"Afonso, Renato",renato.rodrigues@xertica.com,Brasil,Quality Lead,"Batista, Kefreen",kefreen.batista@xertica.com
"Aguiar, Renata",renata.perina@xertica.com,Brasil,Sales Manager,"Rodrigues de Paula, Gustavo",gustavo.paula@xertica.com
"Almeida, Janaina",janaina.almeida@xertica.com,Brasil,MSP Lead,"Batista, Kefreen",kefreen.batista@xertica.com
"Araujo, Alex",alex.araujo@xertica.com,Brasil,Business Development Representative,"Oliveira, Gabriele",gabriele.oliveira@xertica.com
"Ariza, Erika",erika.ariza@xertica.com,Brasil,Operations & Capacity Lead,"Batista, Kefreen",kefreen.batista@xertica.com
"Batista Filho, Anísio",anisio.filho@xertica.com,Brasil,Data Scientist,"Lins, Everton",everton.lins@xertica.com
"Batista, Davy",davy.morais@xertica.com,Brasil,Devops Lead,"Ornellas, Fernando",fernando.ornellas@xertica.com
"Batista, Kefreen",kefreen.batista@xertica.com,Brasil,Chief Delivery Officer,"Chrem, Saul",saul.chrem@xertica.com
"Bica, Atilio Efrain",atilio.grondona@xertica.com,Brasil,Data Scientist,"Lins, Everton",everton.lins@xertica.com
"Bronzatto, César",cesar.bronzatto@xertica.com,Brasil,Sales Enablement Lead,"Rodrigues de Paula, Gustavo",gustavo.paula@xertica.com
"Carrijo, Amanda",amanda.carrijo@xertica.com,Brasil,Product Owner,"Torres, Carol",carol.torres@xertica.com
"Caruso, Renan",renan.caruso@xertica.com,Brasil,Entrepreneur In Residence,"Rodrigues de Paula, Gustavo",gustavo.paula@xertica.com
"Castro, Luciano",luciano.canton@xertica.com,Brasil,Devops Engineer,"Ornellas, Fernando",fernando.ornellas@xertica.com
"Chequer, Gustavo",gustavo.chequer@xertica.com,Brasil,Workspace Specialist Junior,"Struve Cardenas, Hebert Dario",hebert.struve@xertica.com
"Conrado, Danilo",danilo.conrado@xertica.com,Brasil,Developer no-code/low-code,"Rolim, Gerson",gerson.rolim@xertica.com
"da Costa Gonçalves, Emilio",emilio.goncalves@xertica.com,Brasil,Sales Specialist,"Rodrigues de Paula, Gustavo",gustavo.paula@xertica.com
"da Silva, Bruno",Bruno.santos@xertica.com,Brasil,Full Stack Developer,"Lins, Everton",everton.lins@xertica.com
"da Silva, Guilherme",guilherme.loss@xertica.com,Brasil,Scrum Master,"de Melo, Denis, Henrique",denis.melo@xertica.com
"da Silva, Jaiane",jaiane.ferreira@xertica.com,Brasil,Scrum Master,"de Melo, Denis, Henrique",denis.melo@xertica.com
"das Chagas, Natasha",natasha.valegia@xertica.com,Brasil,Quality Analyst,"Afonso, Renato",renato.rodrigues@xertica.com
"de Carvalho, Leonardo Henrique",leonardo.henrique@xertica.com,Brasil,Finance Analyst,"Nize Taveiros Costa, Felipe, Dante",felipe.dante@xertica.com
"de Jesus, Gustavo",gustavo.correia@xertica.com,Brasil,Sales Operations Intern,"Pessoa, Barbara",barbara.pessoa@xertica.com
"de Melo, Denis",denis.melo@xertica.com,Brasil,Delivery Manager,"Sati, Dunia",dunia.sati@xertica.com
"de Melo, Moisés",moises.melo@xertica.com,Brasil,Marketing Analyst,"Guerrero, Desyre",desyre.guerrero@xertica.com
"de Morais, Rafael",rafael.morais@xertica.com,Brasil,Contract Management Specialist,"Ariza, Erika, Seudo",erika.ariza@xertica.com
"de Oliveira Justiniano, Lidiana",lidiana.yassushi@xertica.com,Brasil,Looker Specialist,"Lins, Everton",everton.lins@xertica.com
"de Souza, Julia",julia.souza@xertica.com,Brasil,Administrative Apprentice,"Nize Taveiros Costa, Felipe, Dante",felipe.dante@xertica.com
"de Souza, Luan",luan.souza@xertica.com,Brasil,Developer Full Stack,"Lins, Everton",everton.lins@xertica.com
"De Oliveira, David Jhonatas",david.oliveira@xertica.com,Brasil,Developer Full Stack,"Rolim, Gerson",gerson.rolim@xertica.com
"Del Real, Javier Ernesto",javier.ernesto@xertica.com,Brasil,Data Engineer,"Lins, Everton",everton.lins@xertica.com
"Diniz, Isaque",isaque.diniz@xertica.com,Brasil,Software Architect,"Lins, Everton",everton.lins@xertica.com
"dos Santos, Luiz Henrique",luiz.lopes@xertica.com,Brasil,Developer Front End,"Lins, Everton",everton.lins@xertica.com
"dos Santos, Matheus",matheus.lopes@xertica.com,Brasil,Developer Appshet,"Afonso, Renato",renato.rodrigues@xertica.com
"Dos Santos, Leandro",leandro.mauricio@xertica.com,Brasil,Product Owner,"Torres, Carol",carol.torres@xertica.com
"Faria, Jose",jose.macario@xertica.com,Brasil,Data Scientist,"Lins, Everton",everton.lins@xertica.com
"Ferreira, Fabio",fabio.ferreira@xertica.com,Brasil,Business Development Manager,"Rodrigues de Paula, Gustavo",gustavo.paula@xertica.com
"Ferreira, Willian",Willian.ferreira@xertica.com,Brasil,Developer Front End,"Lins, Everton",everton.lins@xertica.com
"Figueiredo, Ivan",ivan.borges@xertica.com,Brasil,Data Scientist,"Lins, Everton",everton.lins@xertica.com
"Filho, Denilson",denilson.goes@xertica.com,Brasil,Business Development Manager,"Oliveira, Gabriele",gabriele.oliveira@xertica.com
"Fonseca, Luciana",luciana.fonseca@xertica.com,Brasil,Customer Success Specialist,"Oliveira, Gabriele",gabriele.oliveira@xertica.com
"Fragoso, Taina",taina.fragoso@xertica.com,Brasil,GIS Analyst,"Lins, Everton",everton.lins@xertica.com
"Freitas, Andressa",andressa.freitas@xertica.com,Brasil,Quality Analyst,"Afonso, Renato",renato.rodrigues@xertica.com
"Gomes, Marcela",marcela.gomes@xertica.com,Brasil,Operations & Capacity Analyst,"Ariza, Erika, Seudo",erika.ariza@xertica.com
"Gonçalves, Cristiano",cristiano.rocha@xertica.com,Brasil,Gis Specialist,"Lins, Everton",everton.lins@xertica.com
"Gouvea, Gustavo",gustavo.gouvea@xertica.com,Brasil,Data Scientist Lead,"Lins, Everton",everton.lins@xertica.com
"Guerrero, Desyre",desyre.guerrero@xertica.com,Brasil,Marketing Manager,"Rodrigues de Paula, Gustavo",gustavo.paula@xertica.com
"Hassam, Juan",juan.hassam@xertica.com,Brasil,Tech Leader,"Rolim, Gerson",gerson.rolim@xertica.com
"Henrique, Rodolfo",rodolfo.henrique@xertica.com,Brasil,Developer Back End,"Lins, Everton",everton.lins@xertica.com
"Hortencio, João",joao.carlos@xertica.com,Brasil,Product Designer,"Moreira, Marcos Paulo, Leite",marcos.moreira@xertica.com
"Junior, Jose Luis",jose.luis@xertica.com,Brasil,Mobile Developer,"Lins, Everton",everton.lins@xertica.com
"Junqueira, Alexsandra",alexsandra.junqueira@xertica.com,Brasil,Business Development Manager,"Oliveira, Gabriele",gabriele.oliveira@xertica.com
"Lamin Junior, Elias",elias.lamin@xertica.com,Brasil,Head of Customer Engineer,"Rodrigues de Paula, Gustavo",gustavo.paula@xertica.com
"Leal, Domingos",domingos.leal@xertica.com,Brasil,Data Scientist,"Lins, Everton",everton.lins@xertica.com
"Lins, Everton",everton.lins@xertica.com,Brasil,IA Director,"Batista, Kefreen",kefreen.batista@xertica.com
"Lopes, Luana",luana.lopes@xertica.com,Brasil,Scrum Master,"de Melo, Denis, Henrique",denis.melo@xertica.com
"Lopes, Nayara",nayara.lopes@xertica.com,Brasil,Change Management Specialist,"Ortiz Pescador, Ivonne",ivonne.ortiz@xertica.com
"Lopes, Paulo",paulo.lopes@xertica.com,Brasil,GCP Specialist,"Ornellas, Fernando",fernando.ornellas@xertica.com
"Lourenço Cunha, Luis",luis.cunha@xertica.com,Brasil,Developer Back End,"Lins, Everton",everton.lins@xertica.com
"Manhani, Karisa Karla",karisa.manhani@xertica.com,Brasil,Project Manager,"Rolim, Gerson",gerson.rolim@xertica.com
"Marsili, Rodolfo",rodolfo.marsili@xertica.com,Brasil,GCP Specialist,"Ornellas, Fernando",fernando.ornellas@xertica.com
"Martins, Aline",aline.coraiola@xertica.com,Brasil,Product Designer,"Moreira, Marcos Paulo, Leite",marcos.moreira@xertica.com
"Mass, Bruno",bruno.mass@xertica.com,Brasil,Data Manager,"Batista, Kefreen",kefreen.batista@xertica.com
"Mastelini, Camila",camila.mastelini@xertica.com,Brasil,Project  Manager,"Sati, Dunia",dunia.sati@xertica.com
"Maximiano, Cynthia",cynthia.cristina@xertica.com,Brasil,People Assistant,"Oliveira, Kelly",kelly.oliveira@xertica.com
"Meinking, Henrique",henrique.meinking@xertica.com,Brasil,Chief Sales Officer LATAM - Strategic Solutions,"Chrem, Saul",saul.chrem@xertica.com
"Mello, Filipe",filipe.mello@xertica.com,Brasil,Database Specialist,"Lins, Everton",everton.lins@xertica.com
"Mendes, Thayná",thayna.mendes@xertica.com,Brasil,UI/UX DESIGNER,"Moreira, Marcos Paulo, Leite",marcos.moreira@xertica.com
"Moises, Alec",alec.moises@xertica.com,Brasil,Quality Analyst,"Afonso, Renato",renato.rodrigues@xertica.com
"Moll, Carlos",carlos.moll@xertica.com,Brasil,Business Development Manager,"Oliveira, Gabriele",gabriele.oliveira@xertica.com
"Moreira, Marcos Paulo",marcos.moreira@xertica.com,Brasil,Product Designer,"Sati, Dunia",dunia.sati@xertica.com
"Moura da Silva, Rafael",rafael.moura@xertica.com,Brasil,Product Owner,"Torres, Carol",carol.torres@xertica.com
"Nabarrete, Alexandre",alexandre.nabarrete@xertica.com,Brasil,Developer Front End,"Rolim, Gerson",gerson.rolim@xertica.com
"Nascimento, Heleno",heleno.nascimento@xertica.com,Brasil,Scrum Master,"de Melo, Denis, Henrique",denis.melo@xertica.com
"Nize Taveiros Costa, Felipe",felipe.dante@xertica.com,Brasil,Finance Manager,"Castellanos Camargo, Marcela",marcela.castellanos@xertica.com
"Nobrega, Aimê",aime.nobrega@xertica.com,Brasil,Data Scientist,"Lins, Everton",everton.lins@xertica.com
"Nogueira, Joao",joao.nogueira@xertica.com,Brasil,Cloud Architect,"Ornellas, Fernando",fernando.ornellas@xertica.com
"Oliveira, Caio",caio.vidal@xertica.com,Brasil,Sales Enablement Specialist,"Bronzatto, César, Henriques",cesar.bronzatto@xertica.com
"Oliveira, Gabriele",gabriele.oliveira@xertica.com,Brasil,Sales Specialist,"Rodrigues de Paula, Gustavo",gustavo.paula@xertica.com
"Oliveira, Kelly",kelly.oliveira@xertica.com,Brasil,Human Resources Business Partner Junior,"Villegas Clarke, Lucienne",cristina.munoz@xertica.com
"Ornellas, Fernando",fernando.ornellas@xertica.com,Brasil,Delivery Lead,"Batista, Kefreen",kefreen.batista@xertica.com
"Parra, Julio Cesar",julio.parra@xertica.com,Brasil,Quality Analyst Senior,"Afonso, Renato",renato.rodrigues@xertica.com
"Paz, João",joao.bransford@xertica.com,Brasil,Cloud Architect,"Lamin Junior, Elias",elias.lamin@xertica.com
"Pedro, Joao",joao.pedro@xertica.com,Brasil,Developer Back End,"Rolim, Gerson",gerson.rolim@xertica.com
"Pereira da Silva, Ana Ellen",ana.ellen@xertica.com,Brasil,Data Analyst,"Ariza, Erika, Seudo",erika.ariza@xertica.com
"Pereira, Gabriel",gabriel.leick@xertica.com,Brasil,Business Development Manager,"Oliveira, Gabriele",gabriele.oliveira@xertica.com
"Peruchin, Lorenzo",lorenzo.peruchin@xertica.com,Brasil,Entrepreneur In Residence,"Rodrigues de Paula, Gustavo",gustavo.paula@xertica.com
"Pessoa, Barbara",barbara.pessoa@xertica.com,Brasil,Sales Excellence,"Rodrigues de Paula, Gustavo",gustavo.paula@xertica.com
"Petrone, João",joao.petrone@xertica.com,Brasil,Full Stack Developer,"Lins, Everton",everton.lins@xertica.com
"Pichi, Alexandre",alexandre.pichi@xertica.com,Brasil,Sales Operations,"Pessoa, Barbara",barbara.pessoa@xertica.com
"Piffer, Vitoria",vitoria.piffer@xertica.com,Brasil,Scrum Master,"de Melo, Denis, Henrique",denis.melo@xertica.com
"Pontes, Wanusa",wanusa.pontes@xertica.com,Brasil,Data Scientist,"Lins, Everton",everton.lins@xertica.com
"Ramalho, Matheus Antônio",matheus.antonio@xertica.com,Brasil,Full Stack Developer,"Lins, Everton",everton.lins@xertica.com
"Rezende, Yago",yago.rezende@xertica.com,Brasil,Workspace Specialist,"Struve Cardenas, Hebert Dario",hebert.struve@xertica.com
"Rocha Fialho dos Santos, Keila",keila.rocha@xertica.com,Brasil,Project  Manager,"Sati, Dunia",dunia.sati@xertica.com
"Rocha, Ricardo",ricardo.rocha@xertica.com,Brasil,Project  Manager,"Sati, Dunia",dunia.sati@xertica.com
"Rodrigues de Paula, Gustavo",gustavo.paula@xertica.com,Brasil,Country Manager,"Chrem, Saul",saul.chrem@xertica.com
"Rodrigues Ribeiro, Jacqueline",jacqueline.coelho@xertica.com,Brasil,MSP Operations Analyst,"Almeida, Janaina",janaina.almeida@xertica.com
"Rolim, Gerson",gerson.rolim@xertica.com,Brasil,Solutions Director,"Meinking, Henrique",henrique.meinking@xertica.com
"Romano, Gustavo",gustavo.torrecilha@xertica.com,Brasil,Sales Enablement Specialist,"Bronzatto, César, Henriques",cesar.bronzatto@xertica.com
"Rosa, Felipe",felipe.cassin@xertica.com,Brasil,Quality Analyst,"Afonso, Renato",renato.rodrigues@xertica.com
"Sandy, Kathy",kathy.sandy@xertica.com,Brasil,Work Transformation Trainer,"Ortiz Pescador, Ivonne",ivonne.ortiz@xertica.com
"Santos, Amanda",amanda.santos@xertica.com,Brasil,Marketing Specialist,"Guerrero, Desyre",desyre.guerrero@xertica.com
"Santos, Joao",joao.santos@xertica.com,Brasil,Customer Engineer,"Lamin Junior, Elias",Elias.lamin@xertica.com
"Santos, Rafael",rafael.santos@xertica.com,Brasil,Database Architect,"Lins, Everton",everton.lins@xertica.com
"Sati, Dunia",dunia.sati@xertica.com,Brasil,Delivery Director,"Batista, Kefreen",kefreen.batista@xertica.com
"Segantin, Daniel",daniel.segantin@xertica.com,Brasil,Designer da Web,"Moreira, Marcos Paulo, Leite",marcos.moreira@xertica.com
"Seguessi, Lucas",lucas.seguessi@xertica.com,Brasil,Developer Front End,"Lins, Everton",everton.lins@xertica.com
"Silva Marques, Guilherme",guilherme.silva@xertica.com,Brasil,Data Scientist,"Afonso, Renato",renato.rodrigues@xertica.com
"Silva, Allan",allan.silva@xertica.com,Brasil,Full Stack Developer,"Lins, Everton",everton.lins@xertica.com
"Silva, Amália",amalia.silva@xertica.com,Brasil,Sales & Document Performance Analyst,"Oliveira, Gabriele",gabriele.oliveira@xertica.com
"Silva, Andrew",andrew.gomes@xertica.com,Brasil,Quality Analyst,"Afonso, Renato",renato.rodrigues@xertica.com
"Silva, Cleiton",cleiton.silva@xertica.com,Brasil,Developer Back End,"Lins, Everton",everton.lins@xertica.com
"Silva, Michael",michael.silva@xertica.com,Brasil,Project  Manager,"Sati, Dunia",dunia.sati@xertica.com
"Soares, Marcel",marcel.gregorutti@xertica.com,Brasil,Product Owner,"Torres, Carol",carol.torres@xertica.com
"souza, Ivan Lucio",ivan.souza@xertica.com,Brasil,Scrum Master,"de Melo, Denis, Henrique",denis.melo@xertica.com
"Souza, André",andre.souza@xertica.com,Brasil,IT Support Specialist,"Fuentes, Carlos, Fernando",fernando.fuentes@xertica.com
"Steele, Leandro",leandro.steele@xertica.com,Brasil,Customer Engineer,"Lamin Junior, Elias",elias.lamin@xertica.com
"Stephano, Rafael",rafael.stephano@xertica.com,Brasil,Development Manager,"Batista, Kefreen",kefreen.batista@xertica.com
"Stroff, Felipe",felipe.stroff@xertica.com,Brasil,Gis Specialist,"Lins, Everton",everton.lins@xertica.com
"Teixeira, Valter",valter.teixeira@xertica.com,Brasil,Contract Management Leader,"Ariza, Erika, Seudo",erika.ariza@xertica.com
"Theodoro, Thayna",thayna.theodoro@xertica.com,Brasil,OTC Analyst,"Nize Taveiros Costa, Felipe, Dante",felipe.dante@xertica.com
"Trovo, Siria",siria.trovo@xertica.com,Brasil,Accounting Specialist,"Nize Taveiros Costa, Felipe, Dante",felipe.dante@xertica.com
"Uehara, Júlia",julia.uehara@xertica.com,Brasil,Entrepreneur In Residence,"Rodrigues de Paula, Gustavo",gustavo.paula@xertica.com
"Verissimo, Jefferson",jefferson.verissimo@xertica.com,Brasil,Data Engineer,"Lins, Everton",everton.lins@xertica.com
"Vieira, Alécio",alecio.vieira@xertica.com,Brasil,Product Owner,"Torres, Carol",carol.torres@xertica.com
"Winter Junior, Luiz Carlos",luiz.winter@xertica.com,Brasil,Product Owner,"Torres, Carol",carol.torres@xertica.com
"Zanella, Natália",natalia.neres@xertica.com,Brasil,Product Owner,"Torres, Carol",carol.torres@xertica.com
"Zevolli, Rayssa",rayssa.zevolli@xertica.com,Brasil,Customer Success Analyst,"Oliveira, Gabriele",gabriele.oliveira@xertica.com`;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Busca Usuários
      let usersSnap;
      try {
        usersSnap = await getDocs(collection(db, 'users'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'users');
        return;
      }
      const usersData = usersSnap.docs.map(d => ({
        uid: d.id,
        ...d.data()
      })) as UserProfile[];
      
      // Sort by name
      usersData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      setUsers(usersData);

      // Busca Roles para o select
      let rolesSnap;
      try {
        rolesSnap = await getDocs(collection(db, 'roles'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'roles');
        return;
      }
      const rolesData = rolesSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Role[];
      setRoles(rolesData);

      // Busca Áreas para o select
      let areasSnap;
      try {
        areasSnap = await getDocs(collection(db, 'areas'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'areas');
        return;
      }
      const areasData = areasSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Area[];
      setAreas(areasData);

      // Busca Países para o select
      let countriesSnap;
      try {
        countriesSnap = await getDocs(collection(db, 'countries'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'countries');
        return;
      }
      const countriesData = countriesSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Country))
        .filter(c => c.isActive);
      setCountries(countriesData);

      // Busca Projetos
      let projectsSnap;
      try {
        projectsSnap = await getDocs(collection(db, 'projects'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'projects');
        return;
      }
      const projectsData = projectsSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Project[];
      setProjects(projectsData);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user: UserProfile) => {
    setEditingUser(user);
    setSelectedRoleId(user.roleId || '');
    setSelectedAreaId(user.areaId || '');
    setSelectedCountryId(user.countryId || '');
    setSelectedOnboardingJourney(user.onboardingJourney || 'standard');
    setSelectedProjectIds(user.projectIds || []);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsCreateModalOpen(false);
    setIsBulkImportOpen(false);
    setIsDeleteModalOpen(false);
    setIsResetPointsModalOpen(false);
    setIsDeleteOnboardingPointsModalOpen(false);
    setEditingUser(null);
    setUserToDelete(null);
    setUserToReset(null);
    setUserToDeleteOnboardingPoints(null);
    setSelectedRoleId('');
    setSelectedAreaId('');
    setSelectedCountryId('');
    setSelectedOnboardingJourney('standard');
    setSelectedProjectIds([]);
    setBulkData('');
    setImportStatus(null);
    setAdjustmentMode('reset');
    setAdjustmentValues({
      points: 0,
      studyTimeMinutes: 0
    });
    setNewUserFormData({
      name: '',
      email: '',
      roleId: '',
      areaId: '',
      jobTitle: '',
      leaderName: '',
      leaderEmail: '',
      country: 'Brasil',
      countryId: countries.find(c => c.name === 'Brasil')?.id || ''
    });
  };

  const formatName = (name: string) => {
    // "Surname, Name" -> "Name Surname"
    const cleanName = name.replace(/"/g, '').trim();
    if (cleanName.includes(',')) {
      const [surname, firstName] = cleanName.split(',').map(s => s.trim());
      return `${firstName} ${surname}`;
    }
    return cleanName;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const bstr = event.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const csv = XLSX.utils.sheet_to_csv(ws);
      setBulkData(csv);
      toast.success('Planilha carregada! Clique em "Iniciar Importação" para processar.');
    };
    reader.readAsBinaryString(file);
  };

  const handleCleanDuplicates = async () => {
    const duplicateGroups: { [email: string]: UserProfile[] } = {};
    users.forEach(u => {
      if (!u.email) return;
      const email = u.email.toLowerCase().trim();
      if (!duplicateGroups[email]) duplicateGroups[email] = [];
      duplicateGroups[email].push(u);
    });

    const groupsWithDuplicates = Object.values(duplicateGroups).filter(group => group.length > 1);

    if (groupsWithDuplicates.length === 0) {
      toast.info('Nenhum usuário duplicado encontrado.');
      return;
    }

    setDuplicateGroupsToClean(groupsWithDuplicates);
    setIsCleanConfirmOpen(true);
  };

  const executeCleanDuplicates = async () => {
    setIsImporting(true);
    setIsCleanConfirmOpen(false);
    let fixedCount = 0;

    try {
      for (const group of duplicateGroupsToClean) {
        // Sort: non-email UIDs first (official profiles), then by points descending, then by creation date
        const sortedGroup = [...group].sort((a, b) => {
          const aIsEmail = a.uid === a.email;
          const bIsEmail = b.uid === b.email;
          
          // Non-email UIDs take priority
          if (aIsEmail && !bIsEmail) return 1;
          if (!aIsEmail && bIsEmail) return -1;
          
          // Then higher points
          if ((b.points || 0) !== (a.points || 0)) {
            return (b.points || 0) - (a.points || 0);
          }
          
          // Then older accounts
          return (a.createdAt || 0) - (b.createdAt || 0);
        });

        const winner = sortedGroup[0];
        const losers = sortedGroup.slice(1);

        const userRef = doc(db, 'users', winner.uid);
        const updateData: any = {};
        let needsUpdate = false;

        for (const loser of losers) {
          if (winner.uid === loser.uid) continue; // Skip identical docs (shouldn't happen with email list)

          // Merge fields if winner is missing them
          if (!winner.jobTitle && loser.jobTitle) { updateData.jobTitle = loser.jobTitle; needsUpdate = true; }
          if (!winner.leaderName && loser.leaderName) { updateData.leaderName = loser.leaderName; needsUpdate = true; }
          if (!winner.leaderEmail && loser.leaderEmail) { updateData.leaderEmail = loser.leaderEmail; needsUpdate = true; }
          if (!winner.roleId && loser.roleId) { updateData.roleId = loser.roleId; needsUpdate = true; }
          if (!winner.areaId && loser.areaId) { updateData.areaId = loser.areaId; needsUpdate = true; }
          if (!winner.countryId && loser.countryId) { updateData.countryId = loser.countryId; needsUpdate = true; }
          if (!winner.country && loser.country) { updateData.country = loser.country; needsUpdate = true; }
          
          // Sync points if loser has more
          if ((loser.points || 0) > (winner.points || 0)) { updateData.points = loser.points; needsUpdate = true; }
          if ((loser.level || 1) > (winner.level || 1)) { updateData.level = loser.level; needsUpdate = true; }

          // Delete the duplicate
          await deleteDoc(doc(db, 'users', loser.uid));
        }

        if (needsUpdate) {
          await updateDoc(userRef, updateData);
        }
        fixedCount++;
      }
      toast.success(`${fixedCount} grupos de e-mails duplicados foram unificados!`);
      await fetchData();
    } catch (error) {
      console.error("Erro ao limpar duplicatas:", error);
      toast.error("Erro ao processar algumas unificações.");
    } finally {
      setIsImporting(false);
      setDuplicateGroupsToClean([]);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserFormData.name || !newUserFormData.email) return;

    try {
      const email = newUserFormData.email.toLowerCase().trim();
      const userRef = doc(db, 'users', email);
      
      const userData: any = {
        uid: email, // Placeholder UID
        name: newUserFormData.name,
        email: email,
        roleId: newUserFormData.roleId || null,
        areaId: newUserFormData.areaId || null,
        jobTitle: newUserFormData.jobTitle || null,
        leaderName: newUserFormData.leaderName || null,
        leaderEmail: newUserFormData.leaderEmail || null,
        country: newUserFormData.country || 'Brasil',
        countryId: newUserFormData.countryId || null,
        isActive: true,
        createdAt: Date.now(),
        points: 0,
        weeklyPoints: 0,
        level: 1,
        badges: []
      };

      try {
        await setDoc(userRef, userData, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${email}`);
        return;
      }

      handleCloseModal();
      fetchData();
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
    }
  };

  const handleBulkImport = async (customData?: string) => {
    const dataToProcess = typeof customData === 'string' ? customData : bulkData;
    if (!dataToProcess.trim()) return;
    setIsImporting(true);
    setImportStatus(null);

    try {
      const lines = dataToProcess.trim().split('\n');
      // Skip header if present
      const startIdx = lines[0].toLowerCase().includes('e-mail') ? 1 : 0;
      
      const batch = writeBatch(db);
      let count = 0;

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Split by comma not inside quotes
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.trim());
        if (parts.length < 2) continue;

        const rawName = parts[0];
        const email = parts[1].toLowerCase();
        const countryName = parts[2] || 'Brasil';
        const matchedCountry = countries.find(c => c.name.toLowerCase() === countryName.toLowerCase());
        const countryId = matchedCountry?.id || null;
        const jobTitle = parts[3];
        const rawLeaderName = parts[4];
        const leaderEmail = parts[5];

        const name = formatName(rawName);
        const leaderName = rawLeaderName ? formatName(rawLeaderName) : undefined;

        const userRef = doc(db, 'users', email); // Use email as ID for pre-registration
        
        const userData: any = {
          uid: email, // Placeholder UID
          name,
          email,
          country: countryName,
          countryId: countryId,
          jobTitle: jobTitle || null,
          leaderName: leaderName || null,
          leaderEmail: leaderEmail || null,
          isActive: true,
          createdAt: Date.now(),
          points: 0,
          weeklyPoints: 0,
          level: 1,
          badges: []
        };

        batch.set(userRef, userData, { merge: true });
        count++;
      }

      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch_bulk_import');
        return;
      }
      setImportStatus({ success: count, total: lines.length - startIdx });
      await fetchData();
    } catch (error) {
      console.error("Erro no import:", error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      try {
        await deleteDoc(doc(db, 'users', userToDelete.uid));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${userToDelete.uid}`);
      }
      
      // Optional: Clean up progress data
      let progressSnap;
      try {
        progressSnap = await getDocs(collection(db, 'user_progress'));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'user_progress');
        return;
      }
      const userProgress = progressSnap.docs.filter(d => d.data().userId === userToDelete.uid);
      const batch = writeBatch(db);
      userProgress.forEach(d => batch.delete(d.ref));
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'batch_delete_user_progress');
      }

      handleCloseModal();
      fetchData();
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetUserPoints = async () => {
    if (!userToReset) return;
    setIsResetting(true);
    try {
      const userRef = doc(db, 'users', userToReset.uid);
      
      if (adjustmentMode === 'reset') {
        const updates: any = {};
        if (resetOptions.points) updates.points = 0;
        if (resetOptions.weeklyPoints) updates.weeklyPoints = 0;

        if (Object.keys(updates).length > 0) {
          await updateDoc(userRef, updates);
        }

        // Reset progress metrics if selected
        if (resetOptions.studyTime || resetOptions.quizProgress) {
          const progressSnap = await getDocs(query(collection(db, 'user_progress'), where('userId', '==', userToReset.uid)));
          for (const progressDoc of progressSnap.docs) {
            const progressData: any = {};
            if (resetOptions.studyTime) {
              progressData.timeSpentSeconds = 0;
              progressData.videoPercentage = 0;
            }
            if (resetOptions.quizProgress) {
              progressData.highestQuizScore = 0;
              progressData.quizAttempts = 0;
              if (progressData.pointsAwarded) {
                progressData.pointsAwarded = { ...progressData.pointsAwarded, quiz: false };
              }
            }
            
            if (Object.keys(progressData).length > 0) {
              await updateDoc(doc(db, 'user_progress', progressDoc.id), progressData);
            }
          }
        }
      } else {
        // Decrease mode
        if (adjustmentValues.points > 0) {
          await gamificationService.removePoints(userToReset.uid, adjustmentValues.points, 'Ajuste administrativo');
        }

        if (adjustmentValues.studyTimeMinutes > 0) {
          let secondsToSubtract = adjustmentValues.studyTimeMinutes * 60;
          const progressSnap = await getDocs(query(
            collection(db, 'user_progress'), 
            where('userId', '==', userToReset.uid),
            orderBy('lastUpdatedAt', 'desc')
          ));

          for (const progressDoc of progressSnap.docs) {
            if (secondsToSubtract <= 0) break;
            
            const data = progressDoc.data();
            const currentSeconds = data.timeSpentSeconds || 0;
            const subtract = Math.min(currentSeconds, secondsToSubtract);
            
            if (subtract > 0) {
              await updateDoc(doc(db, 'user_progress', progressDoc.id), {
                timeSpentSeconds: currentSeconds - subtract
              });
              secondsToSubtract -= subtract;
            }
          }
        }
      }
      
      toast.success('Métricas atualizadas com sucesso');
      handleCloseModal();
      fetchData();
    } catch (error) {
      console.error("Erro ao atualizar métricas do usuário:", error);
      toast.error('Erro ao atualizar métricas');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteOnboardingPointsForUser = async () => {
    if (!userToDeleteOnboardingPoints) return;
    setIsDeletingOnboardingPoints(true);
    try {
      const userRef = doc(db, 'users', userToDeleteOnboardingPoints.uid);
      const pointsToRemove = userToDeleteOnboardingPoints.onboardingPoints || 0;
      
      // Reset tasks and onboardingPoints field
      await updateDoc(userRef, {
        onboardingTasks: {},
        onboardingPoints: 0
      });
      
      // Remove the points using the service to ensure history and level are updated
      if (pointsToRemove > 0) {
        await gamificationService.removePoints(
          userToDeleteOnboardingPoints.uid, 
          pointsToRemove, 
          'Correção de Onboarding'
        );
      }
      
      toast.success('Pontos de onboarding removidos com sucesso');
      handleCloseModal();
      fetchData();
    } catch (error) {
      console.error("Erro ao remover pontos de onboarding:", error);
      toast.error('Erro ao remover pontos de onboarding');
    } finally {
      setIsDeletingOnboardingPoints(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const userRef = doc(db, 'users', editingUser.uid);
      const updateData: any = {
        roleId: selectedRoleId || null,
        areaId: selectedAreaId || null,
        countryId: selectedCountryId || null,
        country: countries.find(c => c.id === selectedCountryId)?.name || editingUser.country || 'Brasil',
        onboardingJourney: selectedOnboardingJourney,
        projectIds: selectedProjectIds
      };

      try {
        await updateDoc(userRef, updateData);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${editingUser.uid}`);
      }
      handleCloseModal();
      fetchData();
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
    }
  };

  const getRoleName = (roleId?: string) => {
    if (!roleId) return 'Sem Perfil';
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : 'Desconhecido';
  };

  const getAreaName = (areaId?: string) => {
    if (!areaId) return 'Sem Área';
    const area = areas.find(a => a.id === areaId);
    return area ? area.name : 'Desconhecido';
  };

  if (loading) return <div className={`p-8 text-center ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('common.loading')}</div>;

  const filteredUsers = users.filter((user, index) => {
    // Deduplicate by email
    const firstIndex = users.findIndex(u => u.email?.toLowerCase().trim() === user.email?.toLowerCase().trim());
    if (index !== firstIndex) return false;

    const name = user.name || '';
    const email = user.email || '';
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.roleId === roleFilter;
    const matchesArea = areaFilter === 'all' || user.areaId === areaFilter;
    const matchesCountry = countryFilter === 'all' || user.countryId === countryFilter || user.country === countryFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' ? user.isActive : !user.isActive);
    
    return matchesSearch && matchesRole && matchesArea && matchesCountry && matchesStatus;
  });

  return (
    <div className={`space-y-6 transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.users')}</h1>
          <p className="text-sm text-slate-500">Total de {users.length} colaboradores cadastrados.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            Novo Usuário
          </button>
          <button 
            onClick={() => handleBulkImport(BRAZIL_BASE_RAW)}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Importar Base Brasil (Lista Enviada)
          </button>
          <button 
            onClick={() => setIsBulkImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-600/20"
          >
            <Upload className="w-4 h-4" />
            Importar Outro CSV
          </button>
          {users.some((user, index) => users.findIndex(u => u.email === user.email) !== index) && (
            <button 
              onClick={handleCleanDuplicates}
              disabled={isImporting}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Limpar Duplicados
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className={`p-4 rounded-xl border flex flex-wrap items-center gap-4 transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome do colaborador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm outline-none transition-all border ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' 
                : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-300'
            }`}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm outline-none border transition-all ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white' 
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <option value="all">Todos os Perfis</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <select 
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm outline-none border transition-all ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white' 
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <option value="all">Todas as Áreas</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm outline-none border transition-all ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white' 
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <option value="all">Todos os Status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>

          <select 
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className={`px-3 py-2 rounded-lg text-sm outline-none border transition-all ${
              theme === 'dark' 
                ? 'bg-slate-800 border-slate-700 text-white' 
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          >
            <option value="all">Todos os Países</option>
            {countries.map(c => <option key={c.id} value={c.id || c.name}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className={`rounded-xl border overflow-hidden transition-colors ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className={theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Usuário
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                País
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Líder
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Perfil de Acesso
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Área
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                {t('common.actions')}
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-200'}`}>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-slate-500">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.uid} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          user.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user.name}</div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-slate-500">{user.email}</div>
                          {users.filter(u => u.email === user.email).length > 1 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                              Duplicado
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5 flex items-center gap-1">
                          ID: {user.uid}
                          {user.uid === user.email && (
                            <span className="text-blue-500 font-bold">(Pré-registro)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {user.country || 'Brasil'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.leaderName ? (
                      <div className="flex flex-col">
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                          {user.leaderName}
                        </span>
                        {user.leaderEmail && (
                          <span className="text-[10px] text-slate-500">{user.leaderEmail}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Não informado</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                      theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      <Shield className="w-3.5 h-3.5 text-slate-500" />
                      {getRoleName(user.roleId)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
                        theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {getAreaName(user.areaId)}
                      </span>
                      <span className={`inline-flex w-fit items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        user.onboardingJourney === 'eir' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        ONB: {user.onboardingJourney === 'eir' ? 'EIR' : 'Padrão'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.isActive ? (
                      <span className="inline-flex items-center gap-1 text-sm text-emerald-500 font-medium">
                        <CheckCircle2 className="w-4 h-4" /> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm text-slate-400 font-medium">
                        <XCircle className="w-4 h-4" /> Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenModal(user)}
                        className={`px-3 py-1.5 rounded-md transition-colors font-bold ${
                          theme === 'dark' ? 'text-blue-400 bg-blue-400/10 hover:bg-blue-400/20' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                        }`}
                      >
                        Alterar Perfil
                      </button>
                      <button
                        onClick={() => {
                          setUserToReset(user);
                          setIsResetPointsModalOpen(true);
                        }}
                        className={`p-1.5 rounded-md transition-colors ${
                          theme === 'dark' ? 'text-amber-400 hover:bg-amber-400/10' : 'text-amber-600 hover:bg-amber-50'
                        }`}
                        title={t('admin.resetUserPoints')}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      {(user.onboardingPoints || 0) > 0 && (
                        <button
                          onClick={() => {
                            setUserToDeleteOnboardingPoints(user);
                            setIsDeleteOnboardingPointsModalOpen(true);
                          }}
                          className={`p-1.5 rounded-md transition-colors ${
                            theme === 'dark' ? 'text-blue-400 hover:bg-blue-400/10' : 'text-blue-600 hover:bg-blue-50'
                          }`}
                          title={t('admin.deleteOnboardingPoints')}
                        >
                          <Award className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setUserToDelete(user);
                          setIsDeleteModalOpen(true);
                        }}
                        className={`p-1.5 rounded-md transition-colors ${
                          theme === 'dark' ? 'text-rose-400 hover:bg-rose-400/10' : 'text-rose-600 hover:bg-rose-50'
                        }`}
                        title="Excluir Usuário"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

      {/* Modal de Criação de Usuário */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`rounded-xl shadow-2xl max-w-2xl w-full p-6 my-auto animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Incluir Novo Usuário
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-6">
              <div className="max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUserFormData.name}
                      onChange={(e) => setNewUserFormData({...newUserFormData, name: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      E-mail *
                    </label>
                    <input
                      type="email"
                      required
                      value={newUserFormData.email}
                      onChange={(e) => setNewUserFormData({...newUserFormData, email: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      País *
                    </label>
                    <select
                      required
                      value={newUserFormData.countryId}
                      onChange={(e) => {
                        const countryId = e.target.value;
                        const countryName = countries.find(c => c.id === countryId)?.name || '';
                        setNewUserFormData({...newUserFormData, countryId, country: countryName});
                      }}
                      className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">Selecione um País</option>
                      {countries.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {t('admin.jobTitle')}
                    </label>
                    <input
                      type="text"
                      value={newUserFormData.jobTitle}
                      onChange={(e) => setNewUserFormData({...newUserFormData, jobTitle: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {t('admin.accessProfile')}
                    </label>
                    <select
                      value={newUserFormData.roleId}
                      onChange={(e) => setNewUserFormData({...newUserFormData, roleId: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">{t('admin.noProfile')}</option>
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {t('admin.area')}
                    </label>
                    <select
                      value={newUserFormData.areaId}
                      onChange={(e) => setNewUserFormData({...newUserFormData, areaId: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    >
                      <option value="">{t('admin.noArea')}</option>
                      {areas.map(area => (
                        <option key={area.id} value={area.id}>{area.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {t('admin.leaderName')}
                    </label>
                    <input
                      type="text"
                      value={newUserFormData.leaderName}
                      onChange={(e) => setNewUserFormData({...newUserFormData, leaderName: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                      {t('admin.leaderEmail')}
                    </label>
                    <input
                      type="email"
                      value={newUserFormData.leaderEmail}
                      onChange={(e) => setNewUserFormData({...newUserFormData, leaderEmail: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                    theme === 'dark' ? 'text-slate-400 bg-slate-800 hover:bg-slate-700' : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                >
                  {t('admin.createUser')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição de Perfil */}
      {isModalOpen && editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`rounded-xl shadow-2xl max-w-md w-full p-6 my-auto animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {t('admin.changeAccessProfile')}
            </h2>
            
            <div className={`mb-6 p-4 rounded-lg border ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{editingUser.name}</p>
              <p className="text-sm text-slate-500">{editingUser.email}</p>
              {editingUser.jobTitle && <p className="text-xs text-slate-400 mt-1">{editingUser.jobTitle}</p>}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                <div>
                  <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t('admin.country')}
                  </label>
                  <select
                    value={selectedCountryId}
                    onChange={(e) => setSelectedCountryId(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">{t('admin.selectCountryPlaceholder')}</option>
                    {countries.map(country => (
                      <option key={country.id} value={country.id}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t('admin.selectProfile')}
                  </label>
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">{t('admin.noProfile')}</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t('admin.selectArea')}
                  </label>
                  <select
                    value={selectedAreaId}
                    onChange={(e) => setSelectedAreaId(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="">{t('admin.noAreaNoTracks')}</option>
                    {areas.map(area => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {t('admin.areaDesc')}
                  </p>
                </div>

                <div>
                  <label className={`block text-sm font-bold mb-1 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t('admin.onboardingJourney', 'Jornada de Onboarding')}
                  </label>
                  <select
                    value={selectedOnboardingJourney}
                    onChange={(e) => setSelectedOnboardingJourney(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500/50 ${
                      theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="standard">{t('admin.journeyStandard', 'Padrão')}</option>
                    <option value="eir">{t('admin.journeyEir', 'EIR (Líderes do Futuro)')}</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {t('admin.journeyDesc', 'Define qual jornada de Onboarding será apresentada a este usuário.')}
                  </p>
                </div>

                <div>
                  <label className={`block text-sm font-bold mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t('admin.linkedProjects')}
                  </label>
                  <div className={`p-3 rounded-lg border max-h-40 overflow-y-auto space-y-2 custom-scrollbar ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                  }`}>
                    {projects.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-2">{t('admin.noProjects')}</p>
                    ) : (
                      projects.map(project => (
                        <label 
                          key={project.id} 
                          className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors border ${
                            selectedProjectIds.includes(project.id!)
                              ? (theme === 'dark' ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-indigo-50 border-indigo-200')
                              : (theme === 'dark' ? 'hover:bg-slate-700 border-transparent' : 'hover:bg-slate-50 border-transparent')
                          }`}
                        >
                          <input 
                            type="checkbox"
                            checked={selectedProjectIds.includes(project.id!)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProjectIds([...selectedProjectIds, project.id!]);
                              } else {
                                setSelectedProjectIds(selectedProjectIds.filter(id => id !== project.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{project.name}</p>
                            {project.description && <p className="text-[10px] text-slate-500 truncate">{project.description}</p>}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {t('admin.projectsDesc')}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                    theme === 'dark' ? 'text-slate-400 bg-slate-800 hover:bg-slate-700' : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {isDeleteModalOpen && userToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-lg">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold">Excluir Usuário</h2>
            </div>
            
            <p className={`mb-6 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              Tem certeza que deseja excluir o usuário <span className="font-bold text-rose-500">{userToDelete.name}</span>? 
              Esta ação é irreversível e removerá todo o progresso e acesso do colaborador.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                disabled={isDeleting}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                  theme === 'dark' ? 'text-slate-400 bg-slate-800 hover:bg-slate-700' : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-rose-600 rounded-md hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('common.deleting')}
                  </>
                ) : (
                  t('admin.confirmDeletion')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Reset de Métricas */}
      {isResetPointsModalOpen && userToReset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4 text-amber-600">
              <div className="p-2 bg-amber-100 rounded-lg">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold">Gerenciar Métricas do Usuário</h2>
            </div>
            
            <p className={`mb-6 text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              Ajuste ou zere as informações de <span className="font-bold text-amber-500">{userToReset.name}</span>.
            </p>

            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
              <button
                onClick={() => setAdjustmentMode('reset')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  adjustmentMode === 'reset' 
                    ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Zerar Dados
              </button>
              <button
                onClick={() => setAdjustmentMode('decrease')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  adjustmentMode === 'decrease' 
                    ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Diminuir Valores
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto pr-2 mb-6 custom-scrollbar">
              {adjustmentMode === 'reset' ? (
                <div className="space-y-3">
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    resetOptions.points ? (theme === 'dark' ? 'bg-amber-900/20 border-amber-500/50' : 'bg-amber-50 border-amber-200') : (theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')
                  }`}>
                    <input 
                      type="checkbox" 
                      checked={resetOptions.points} 
                      onChange={(e) => setResetOptions(prev => ({ ...prev, points: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.resetTotalPoints')}</p>
                      <p className="text-[10px] text-slate-500">{t('admin.resetTotalPointsDesc')}</p>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    resetOptions.weeklyPoints ? (theme === 'dark' ? 'bg-amber-900/20 border-amber-500/50' : 'bg-amber-50 border-amber-200') : (theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')
                  }`}>
                    <input 
                      type="checkbox" 
                      checked={resetOptions.weeklyPoints} 
                      onChange={(e) => setResetOptions(prev => ({ ...prev, weeklyPoints: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.resetWeeklyPoints')}</p>
                      <p className="text-[10px] text-slate-500">{t('admin.resetWeeklyPointsDesc')}</p>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    resetOptions.studyTime ? (theme === 'dark' ? 'bg-amber-900/20 border-amber-500/50' : 'bg-amber-50 border-amber-200') : (theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')
                  }`}>
                    <input 
                      type="checkbox" 
                      checked={resetOptions.studyTime} 
                      onChange={(e) => setResetOptions(prev => ({ ...prev, studyTime: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.resetStudyTime')}</p>
                      <p className="text-[10px] text-slate-500">{t('admin.resetStudyTimeDesc')}</p>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    resetOptions.quizProgress ? (theme === 'dark' ? 'bg-amber-900/20 border-amber-500/50' : 'bg-amber-50 border-amber-200') : (theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')
                  }`}>
                    <input 
                      type="checkbox" 
                      checked={resetOptions.quizProgress} 
                      onChange={(e) => setResetOptions(prev => ({ ...prev, quizProgress: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.resetQuizGrades')}</p>
                      <p className="text-[10px] text-slate-500">{t('admin.resetQuizGradesDesc')}</p>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                      {t('admin.removePoints')}
                    </label>
                    <div className="relative">
                      <input 
                        type="number"
                        value={adjustmentValues.points}
                        onChange={(e) => setAdjustmentValues(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                        className={`w-full pl-4 pr-12 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-amber-500/20 ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                        }`}
                        placeholder={t('admin.pointsAmountPlaceholder')}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">PTS</span>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                      {t('admin.removeStudyTime')}
                    </label>
                    <div className="relative">
                      <input 
                        type="number"
                        value={adjustmentValues.studyTimeMinutes}
                        onChange={(e) => setAdjustmentValues(prev => ({ ...prev, studyTimeMinutes: parseInt(e.target.value) || 0 }))}
                        className={`w-full pl-4 pr-12 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-amber-500/20 ${
                          theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                        }`}
                        placeholder={t('admin.minutesAmountPlaceholder')}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">MIN</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                disabled={isResetting}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                  theme === 'dark' ? 'text-slate-400 bg-slate-800 hover:bg-slate-700' : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleResetUserPoints}
                disabled={isResetting || (adjustmentMode === 'reset' && !Object.values(resetOptions).some(v => v)) || (adjustmentMode === 'decrease' && adjustmentValues.points <= 0 && adjustmentValues.studyTimeMinutes <= 0)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-amber-600 rounded-md hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/20 disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('common.processing')}
                  </>
                ) : (
                  adjustmentMode === 'reset' ? t('admin.confirmReset') : t('admin.confirmAdjustment')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Excluir Pontos Onboarding */}
      {isDeleteOnboardingPointsModalOpen && userToDeleteOnboardingPoints && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`rounded-xl shadow-2xl max-w-lg w-full p-6 my-auto animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Award className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {t('admin.deleteOnboardingPoints')}
              </h2>
            </div>

            <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('admin.deleteOnboardingPointsConfirm', { name: userToDeleteOnboardingPoints.name })}
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseModal}
                disabled={isDeletingOnboardingPoints}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                  theme === 'dark' ? 'text-slate-400 bg-slate-800 hover:bg-slate-700' : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteOnboardingPointsForUser}
                disabled={isDeletingOnboardingPoints}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50"
              >
                {isDeletingOnboardingPoints ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('common.processing')}
                  </>
                ) : (
                  t('admin.confirmDeletion')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Importação em Massa */}
      {isBulkImportOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className={`rounded-xl shadow-2xl max-w-2xl w-full p-6 my-auto animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Upload className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {t('admin.importUsers')}
              </h2>
            </div>

            {importStatus ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t('admin.importCompleted')}</h3>
                  <p className="text-slate-500">
                    {importStatus.success} {t('admin.usersProcessedFrom')} {importStatus.total} {t('admin.lines')}
                  </p>
                </div>
                <button 
                  onClick={handleCloseModal}
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all"
                >
                  {t('common.close')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border flex items-start gap-3 ${theme === 'dark' ? 'bg-blue-900/20 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold">{t('common.instructions')}</p>
                    <p>{t('admin.importInstructions1')}</p>
                    <p>{t('admin.importInstructions2')}</p>
                  </div>
                </div>

                <div className="flex gap-3 mb-4">
                  <label className={`flex-1 flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-50/50 ${
                    theme === 'dark' ? 'border-slate-800 bg-slate-800/50 hover:bg-blue-900/10' : 'border-slate-200 bg-slate-50'
                  }`}>
                    <FileSpreadsheet className={`w-8 h-8 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`} />
                    <div className="text-center">
                      <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Carregar arquivo Excel ou CSV</p>
                      <p className="text-[10px] text-slate-500">O sistema converterá automaticamente para o formato necessário</p>
                    </div>
                    <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                  </label>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ou cole os dados manualmente</span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                </div>

                <textarea 
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                  placeholder={t('admin.importPlaceholder')}
                  className={`w-full h-64 p-4 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-xs ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />

                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleCloseModal}
                    disabled={isImporting}
                    className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                      theme === 'dark' ? 'text-slate-400 bg-slate-800 hover:bg-slate-700' : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={() => handleBulkImport()}
                    disabled={isImporting || !bulkData.trim()}
                    className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('common.processing')}
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        {t('admin.startImport')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Limpeza de Duplicados */}
      {isCleanConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-lg">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold">Unificar Duplicatas</h2>
            </div>
            
            <p className={`mb-6 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              Foram identificados <span className="font-bold text-rose-500">{duplicateGroupsToClean.length} e-mails</span> com múltiplos cadastros. 
              Deseja unificá-los agora? 
              <br/><br/>
              O sistema manterá o perfil oficial de cada colaborador e removerá as duplicatas, preservando todos os dados importantes.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsCleanConfirmOpen(false)}
                className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                  theme === 'dark' ? 'text-slate-400 bg-slate-800 hover:bg-slate-700' : 'text-slate-600 bg-white border border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={executeCleanDuplicates}
                className="px-6 py-2 text-sm font-bold text-white bg-rose-600 rounded-md hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/20"
              >
                Sim, Unificar Tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
